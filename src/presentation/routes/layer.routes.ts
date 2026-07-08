import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import {
  listLayersQuerySchema,
  createLayerSchema,
  updateLayerSchema,
} from '../schemas/layer.schema.js';
import { successResponse, paginatedResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role, GeometryType } from '../../domain/enums.js';
import { localizeEntity, localizeEntities } from '../../application/utils/localize.js';
import { resolveLang } from '../utils/lang.util.js';
import { config } from '../../config/env.config.js';

import { ListLayersUseCase } from '../../application/use-cases/layers/list-layers.use-case.js';
import { GetLayerUseCase } from '../../application/use-cases/layers/get-layer.use-case.js';
import { CreateLayerUseCase } from '../../application/use-cases/layers/create-layer.use-case.js';
import { UpdateLayerUseCase } from '../../application/use-cases/layers/update-layer.use-case.js';
import { DeleteLayerUseCase } from '../../application/use-cases/layers/delete-layer.use-case.js';
import { GetSourceFileUseCase } from '../../application/use-cases/layers/get-source-file.use-case.js';
import { ResyncLayerUseCase } from '../../application/use-cases/layers/resync-layer.use-case.js';
import { StageFileImportUseCase } from '../../application/use-cases/layers/stage-file-import.use-case.js';
import { CreateLayerFromStagingUseCase } from '../../application/use-cases/layers/create-layer-from-staging.use-case.js';
import { CreateLayerFromOsmUseCase } from '../../application/use-cases/layers/create-layer-from-osm.use-case.js';
import { ApplyLayerStyleUseCase } from '../../application/use-cases/layers/apply-layer-style.use-case.js';

const IMPORT_ALLOWED_MIMETYPES = [
  'application/json',
  'application/geo+json',
  'application/vnd.google-earth.kml+xml',
  'application/geopackage+sqlite3',
  'application/x-shapefile',
  'application/zip',
  'application/octet-stream',
];
const IMPORT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function parseBody<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } };
  },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new ValidationError(
      'Validation failed',
      result.error?.format() as Record<string, unknown>,
    );
  return result.data as T;
}

const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });
const layerIdParamSchema = z.object({ instanceId: z.string().uuid(), id: z.string().uuid() });

export async function layerRoutes(app: FastifyInstance): Promise<void> {
  const listLayersUseCase = app.diContainer.resolve<ListLayersUseCase>('listLayersUseCase');
  const getLayerUseCase = app.diContainer.resolve<GetLayerUseCase>('getLayerUseCase');
  const createLayerUseCase = app.diContainer.resolve<CreateLayerUseCase>('createLayerUseCase');
  const updateLayerUseCase = app.diContainer.resolve<UpdateLayerUseCase>('updateLayerUseCase');
  const deleteLayerUseCase = app.diContainer.resolve<DeleteLayerUseCase>('deleteLayerUseCase');

  app.get(
    '/',
    {
      schema: {
        description: 'Lister les couches',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(listLayersQuerySchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const query = parseBody(listLayersQuerySchema, request.query);
      const result = await listLayersUseCase.execute(instanceId, query);
      const totalPages = Math.ceil(result.total / (query.limit ?? 20));
      return reply.send(
        paginatedResponse(localizeEntities(result.data, resolveLang(request)), {
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          total: result.total,
          totalPages,
        }),
      );
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        description: 'Obtenir une couche par ID',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(layerIdParamSchema, request.params);
      const result = await getLayerUseCase.execute(id);
      // name/description sont stockés en JSON multilingue ({fr,en}, voir CreateInstanceUseCase) -
      // localisés ici comme sur /catalog (voir GetCatalogUseCase) : cette route sert à activer une
      // couche sur la carte (recommandations, assistant, plans enregistrés), jamais à l'édition,
      // donc renvoyer le nom brut n'a pas d'utilité ici.
      return reply.send(successResponse(localizeEntity(result, resolveLang(request))));
    },
  );

  app.post(
    '/',
    {
      schema: {
        description: 'Créer une couche',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(createLayerSchema),
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const dto = parseBody(createLayerSchema, request.body);
      const result = await createLayerUseCase.execute(instanceId, dto);
      return reply.status(201).send(successResponse(result));
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        description: 'Mettre à jour une couche',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(updateLayerSchema),
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(layerIdParamSchema, request.params);
      const dto = parseBody(updateLayerSchema, request.body);
      const result = await updateLayerUseCase.execute(id, dto);
      return reply.send(successResponse(result));
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        description: 'Supprimer une couche',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(layerIdParamSchema, request.params);
      await deleteLayerUseCase.execute(id);
      return reply.send(successResponse(null));
    },
  );

  // GET /:id/source-file — get the original source file from MinIO
  const getSourceFileUseCase =
    app.diContainer.resolve<GetSourceFileUseCase>('getSourceFileUseCase');
  app.get(
    '/:id/source-file',
    {
      schema: {
        description: "Obtenir le fichier source d'une couche",
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(layerIdParamSchema, request.params);
      const result = await getSourceFileUseCase.execute(id);
      return reply.send(successResponse(result));
    },
  );

  // POST /:id/resync — recharge une couche par défaut depuis les données OSM déjà
  // importées (pas un nouveau téléchargement OSM, voir ResyncLayerUseCase).
  const resyncLayerUseCase = app.diContainer.resolve<ResyncLayerUseCase>('resyncLayerUseCase');
  app.post(
    '/:id/resync',
    {
      schema: {
        description: 'Resynchroniser une couche par défaut depuis les données OSM importées',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(layerIdParamSchema, request.params);
      const result = await resyncLayerUseCase.execute(id);
      return reply.send(successResponse(result));
    },
  );

  // POST /import/file — importe un fichier géospatial (GeoJSON/KML/GPKG/Shapefile zippé/...)
  // dans une table de staging, sans encore créer de couche - permet un aperçu avant
  // confirmation (voir POST /import/file/confirm).
  const stageFileImportUseCase =
    app.diContainer.resolve<StageFileImportUseCase>('stageFileImportUseCase');
  app.post(
    '/import/file',
    {
      schema: {
        description: 'Importer un fichier géospatial en staging (aperçu avant publication)',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await request.file();
      if (!data) throw new ValidationError('No file uploaded', {});

      const buffer = await data.toBuffer();
      if (buffer.length > IMPORT_MAX_FILE_SIZE) {
        throw new ValidationError(
          `File too large. Maximum size is ${IMPORT_MAX_FILE_SIZE / 1024 / 1024}MB`,
          {},
        );
      }
      if (!IMPORT_ALLOWED_MIMETYPES.includes(data.mimetype)) {
        throw new ValidationError('Unsupported file type', { mimetype: data.mimetype });
      }

      const dataDir = config.DATA_DIR;
      await mkdir(dataDir, { recursive: true });
      const ext = path.extname(data.filename) || '.geojson';
      const tmpPath = path.join(dataDir, `layer-import-${randomUUID()}${ext}`);
      await writeFile(tmpPath, buffer);

      try {
        const result = await stageFileImportUseCase.execute(tmpPath);
        return reply.send(successResponse(result));
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    },
  );

  // POST /import/file/confirm — promeut la table de staging en couche définitive (schéma/
  // table calculés automatiquement, enregistrement dans le projet QGIS de l'instance).
  const createLayerFromStagingUseCase = app.diContainer.resolve<CreateLayerFromStagingUseCase>(
    'createLayerFromStagingUseCase',
  );
  const confirmFileImportSchema = z.object({
    stagingTable: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    subGroupId: z.string().uuid(),
    minZoom: z.number().int().min(0).max(22).optional(),
    maxZoom: z.number().int().min(0).max(22).optional(),
    opacity: z.number().min(0).max(1).optional(),
    isVisible: z.boolean().optional(),
    isQueryable: z.boolean().optional(),
  });
  app.post(
    '/import/file/confirm',
    {
      schema: {
        description: 'Confirmer et publier une couche importée depuis un fichier',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(confirmFileImportSchema),
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const dto = parseBody(confirmFileImportSchema, request.body);
      const result = await createLayerFromStagingUseCase.execute(instanceId, dto);
      return reply.status(201).send(successResponse(result));
    },
  );

  // POST /import/osm/confirm — crée une couche filtrée par tag OSM (schéma/table calculés
  // automatiquement, table créée directement sans étape de staging - voir
  // CreateLayerFromOsmUseCase).
  const createLayerFromOsmUseCase = app.diContainer.resolve<CreateLayerFromOsmUseCase>(
    'createLayerFromOsmUseCase',
  );
  const confirmOsmImportSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    subGroupId: z.string().uuid(),
    geometryType: z.nativeEnum(GeometryType),
    conditions: z.array(z.object({ key: z.string().min(1), value: z.string().min(1) })).min(1),
    minZoom: z.number().int().min(0).max(22).optional(),
    maxZoom: z.number().int().min(0).max(22).optional(),
    opacity: z.number().min(0).max(1).optional(),
    isVisible: z.boolean().optional(),
    isQueryable: z.boolean().optional(),
  });
  app.post(
    '/import/osm/confirm',
    {
      schema: {
        description: 'Confirmer et publier une couche filtrée par tag OSM',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(confirmOsmImportSchema),
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const dto = parseBody(confirmOsmImportSchema, request.body);
      const result = await createLayerFromOsmUseCase.execute(instanceId, dto);
      return reply.status(201).send(successResponse(result));
    },
  );

  // POST /:id/style/apply — applique un style couleur+icône (couches ponctuelles : régénère
  // l'icône SVG et pilote le rendu cluster client + QGIS ; autres géométries : couleur QGIS
  // uniquement) ou le style natif d'un KML importé (multipart, fichier optionnel selon le mode).
  const applyLayerStyleUseCase =
    app.diContainer.resolve<ApplyLayerStyleUseCase>('applyLayerStyleUseCase');
  const applyStyleFieldsSchema = z.object({
    mode: z.enum(['color-icon', 'kml']),
    color: z.string().optional(),
    iconKey: z.string().optional(),
    shape: z.enum(['circle', 'square', 'triangle', 'star', 'pin']).optional(),
  });
  app.post(
    '/:id/style/apply',
    {
      schema: {
        description: 'Appliquer un style (couleur+icône ou KML) à une couche',
        tags: ['Couches'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(layerIdParamSchema, request.params);
      const data = request.isMultipart() ? await request.file() : undefined;

      const rawFields = data
        ? Object.fromEntries(
            Object.entries(data.fields)
              .filter(([, v]) => v && typeof v === 'object' && 'value' in v)
              .map(([k, v]) => [k, (v as { value: unknown }).value]),
          )
        : ((request.body as Record<string, unknown>) ?? {});
      const { mode, color, iconKey, shape } = parseBody(applyStyleFieldsSchema, rawFields);

      if (mode === 'kml') {
        if (!data) throw new ValidationError('Fichier KML manquant.', {});
        const buffer = await data.toBuffer();
        const dataDir = config.DATA_DIR;
        await mkdir(dataDir, { recursive: true });
        const tmpPath = path.join(dataDir, `kml-style-${randomUUID()}.kml`);
        await writeFile(tmpPath, buffer);
        try {
          const result = await applyLayerStyleUseCase.execute({
            layerId: id,
            mode: 'kml',
            kmlFilePath: tmpPath,
          });
          return reply.send(successResponse(result));
        } finally {
          await unlink(tmpPath).catch(() => undefined);
        }
      }

      if (!color) throw new ValidationError('Couleur manquante.', {});
      const result = await applyLayerStyleUseCase.execute({
        layerId: id,
        mode: 'color-icon',
        color,
        iconKey,
        shape,
      });
      return reply.send(successResponse(result));
    },
  );
}
