import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role, GeometryType } from '../../domain/enums.js';
import { config } from '../../config/env.config.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { GetQgisProjectUseCase } from '../../application/use-cases/qgis-projects/get-qgis-project.use-case.js';
import { ReloadQgisProjectUseCase } from '../../application/use-cases/qgis-projects/reload-qgis-project.use-case.js';
import { UploadQgisProjectUseCase } from '../../application/use-cases/qgis-projects/upload-qgis-project.use-case.js';
import { ListQgisProjectLayersUseCase } from '../../application/use-cases/qgis-projects/list-qgis-project-layers.use-case.js';
import { CreateLayersFromQgisProjectUseCase } from '../../application/use-cases/layers/create-layers-from-qgis-project.use-case.js';
import { ExportQgisProjectBundleUseCase } from '../../application/use-cases/qgis-projects/export-qgis-project-bundle.use-case.js';

const UPLOAD_ALLOWED_MIMETYPES = [
  'application/zip',
  'application/octet-stream',
  'application/x-qgis-project',
];
const UPLOAD_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB - un .qgz peut embarquer ses propres données

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });
const qgisProjectIdParamSchema = z.object({ instanceId: z.string().uuid(), qgisProjectId: z.string().uuid() });

export async function qgisProjectRoutes(app: FastifyInstance): Promise<void> {
  const getQgisProjectUseCase = app.diContainer.resolve<GetQgisProjectUseCase>('getQgisProjectUseCase');
  const reloadQgisProjectUseCase = app.diContainer.resolve<ReloadQgisProjectUseCase>('reloadQgisProjectUseCase');
  const uploadQgisProjectUseCase = app.diContainer.resolve<UploadQgisProjectUseCase>('uploadQgisProjectUseCase');
  const listQgisProjectLayersUseCase = app.diContainer.resolve<ListQgisProjectLayersUseCase>('listQgisProjectLayersUseCase');
  const createLayersFromQgisProjectUseCase = app.diContainer.resolve<CreateLayersFromQgisProjectUseCase>('createLayersFromQgisProjectUseCase');
  const exportQgisProjectBundleUseCase = app.diContainer.resolve<ExportQgisProjectBundleUseCase>('exportQgisProjectBundleUseCase');

  app.get('/', { schema: { description: 'Obtenir le projet QGIS d\'une instance', tags: ['Projets QGIS'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const result = await getQgisProjectUseCase.execute(instanceId);
    return reply.send(successResponse(result));
  });

  app.post('/reload', { schema: { description: 'Recharger le projet QGIS d\'une instance', tags: ['Projets QGIS'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const result = await reloadQgisProjectUseCase.execute(instanceId);
    return reply.send(successResponse(result));
  });

  // POST /upload — héberge un projet QGIS fourni par l'admin (.qgz autonome, ou .zip
  // contenant un .qgs + ses données) pour la source "Projet QGIS" de l'assistant de couche.
  app.post('/upload', {
    schema: { description: 'Uploader un projet QGIS (.qgz ou .zip contenant un .qgs)', tags: ['Projets QGIS'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const data = await request.file();
    if (!data) throw new ValidationError('No file uploaded', {});

    const buffer = await data.toBuffer();
    if (buffer.length > UPLOAD_MAX_FILE_SIZE) {
      throw new ValidationError(`File too large. Maximum size is ${UPLOAD_MAX_FILE_SIZE / 1024 / 1024}MB`, {});
    }
    const ext = path.extname(data.filename).toLowerCase();
    if (ext !== '.qgz' && ext !== '.qgs' && ext !== '.zip') {
      throw new ValidationError('Format de projet QGIS non supporté (.qgz, .qgs ou .zip attendu).', { filename: data.filename });
    }
    if (!UPLOAD_ALLOWED_MIMETYPES.includes(data.mimetype) && ext !== '.qgz' && ext !== '.qgs') {
      throw new ValidationError('Unsupported file type', { mimetype: data.mimetype });
    }

    const fieldsSchema = z.object({ name: z.string().min(1), description: z.string().optional() });
    const rawFields = Object.fromEntries(
      Object.entries(data.fields)
        .filter(([, v]) => v && typeof v === 'object' && 'value' in v)
        .map(([k, v]) => [k, (v as { value: unknown }).value]),
    );
    const { name, description } = parseBody(fieldsSchema, rawFields);

    const dataDir = config.DATA_DIR;
    await mkdir(dataDir, { recursive: true });
    const tmpPath = path.join(dataDir, `qgis-upload-${randomUUID()}${ext}`);
    await writeFile(tmpPath, buffer);

    try {
      const result = await uploadQgisProjectUseCase.execute({
        instanceId,
        name,
        description,
        uploadedFilePath: tmpPath,
        originalFilename: data.filename,
      });
      return reply.status(201).send(successResponse(result));
    } finally {
      await unlink(tmpPath).catch(() => undefined);
    }
  });

  // GET /:qgisProjectId/layers — liste les couches exposées par le WMS du projet (pour que
  // l'admin choisisse lesquelles publier comme couches GeOSM).
  app.get('/:qgisProjectId/layers', {
    schema: { description: 'Lister les couches d\'un projet QGIS', tags: ['Projets QGIS'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { qgisProjectId } = parseBody(qgisProjectIdParamSchema, request.params);
    const result = await listQgisProjectLayersUseCase.execute(qgisProjectId);
    return reply.send(successResponse(result));
  });

  // POST /:qgisProjectId/layers/confirm — crée une couche GeOSM par couche sélectionnée dans
  // le projet QGIS uploadé (aucune table PostGIS gérée par GeOSM - la donnée reste dans les
  // sources propres du projet, servie via son propre WMS).
  const confirmQgisLayersSchema = z.object({
    subGroupId: z.string().uuid(),
    layers: z.array(z.object({
      layerName: z.string().min(1),
      displayName: z.string().min(1),
      geometryType: z.nativeEnum(GeometryType),
    })).min(1),
  });
  app.post('/:qgisProjectId/layers/confirm', {
    schema: { description: 'Publier des couches GeOSM depuis un projet QGIS', tags: ['Projets QGIS'], security: [{ bearerAuth: [] }], body: zodToSwagger(confirmQgisLayersSchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId, qgisProjectId } = parseBody(qgisProjectIdParamSchema, request.params);
    const dto = parseBody(confirmQgisLayersSchema, request.body);
    const result = await createLayersFromQgisProjectUseCase.execute(instanceId, { qgisProjectId, ...dto });
    return reply.status(201).send(successResponse(result));
  });

  // GET /:qgisProjectId/export — empaquette le projet complet (projet + toutes les couches +
  // leur donnée actuelle + leurs styles) en une archive .zip autonome, utilisable directement
  // dans QGIS Desktop (plus de dépendance à la base PostGIS de GeOSM).
  app.get('/:qgisProjectId/export', {
    schema: { description: 'Télécharger un projet QGIS complet (données + styles), autonome', tags: ['Projets QGIS'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { qgisProjectId } = parseBody(qgisProjectIdParamSchema, request.params);
    const result = await exportQgisProjectBundleUseCase.execute(qgisProjectId);
    return reply.send(successResponse(result));
  });
}
