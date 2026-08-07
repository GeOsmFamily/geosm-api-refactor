import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import { config } from '../../config/env.config.js';
import { appConfig } from '../../config/app.config.js';
import { signPersonalWmsToken } from '../../infrastructure/utils/personal-wms-token.util.js';

import { StageFileImportUseCase } from '../../application/use-cases/layers/stage-file-import.use-case.js';
import { ImportPersonalFileUseCase } from '../../application/use-cases/personal-layers/import-personal-file.use-case.js';
import { ImportPersonalQgisProjectUseCase } from '../../application/use-cases/personal-layers/import-personal-qgis-project.use-case.js';
import { ListMyPersonalLayersUseCase } from '../../application/use-cases/personal-layers/list-my-personal-layers.use-case.js';
import { DeletePersonalLayerUseCase } from '../../application/use-cases/personal-layers/delete-personal-layer.use-case.js';
import { GetPersonalLayerFeaturesUseCase } from '../../application/use-cases/personal-layers/get-personal-layer-features.use-case.js';
import { ApplyPersonalLayerStyleUseCase } from '../../application/use-cases/personal-layers/apply-personal-layer-style.use-case.js';
import { RequestPersonalLayerPublicationUseCase } from '../../application/use-cases/personal-layers/request-personal-layer-publication.use-case.js';
import { ListPendingPersonalLayerPublicationsUseCase } from '../../application/use-cases/personal-layers/list-pending-personal-layer-publications.use-case.js';
import { ReviewPersonalLayerPublicationUseCase } from '../../application/use-cases/personal-layers/review-personal-layer-publication.use-case.js';
import { UploadPersonalLayerQmlStyleUseCase } from '../../application/use-cases/personal-layers/upload-personal-layer-qml-style.use-case.js';
import { PersonalLayerRecord } from '../../infrastructure/database/repositories/prisma-personal-layer.repository.js';

/** Ajoute une URL WMS prête à l'emploi pour une donnée QGIS_PROJECT - contrairement au catalogue
 * (CreateLayersFromQgisProjectUseCase, données publiques par nature), une donnée PERSONNELLE ne
 * doit être accessible qu'à son propriétaire : passe par le proxy authentifié
 * /personal-wms (voir personal-wms.routes.ts) avec un jeton signé embarquant le chemin du
 * projet, plutôt que d'exposer QGIS_PUBLIC_URL?map=<chemin> en clair (voir plan
 * "Interopérabilité & sécurité des données" du 2026-08-06 - avant ce correctif, ce chemin
 * "difficile à deviner" était la SEULE protection, sans aucune vérification réelle). */
function toDto(record: PersonalLayerRecord): PersonalLayerRecord & { sourceUrl: string | null } {
  const sourceUrl =
    record.sourceType === 'QGIS_PROJECT' && record.qgisProjectPath
      ? `${appConfig.apiPrefix}/personal-wms?token=${signPersonalWmsToken({
          userId: record.userId,
          personalLayerId: record.id,
          qgisProjectPath: record.qgisProjectPath,
        })}`
      : null;
  return { ...record, sourceUrl };
}

const IMPORT_ALLOWED_MIMETYPES = [
  'application/json',
  'application/geo+json',
  'application/vnd.google-earth.kml+xml',
  'application/geopackage+sqlite3',
  'application/x-shapefile',
  'application/zip',
  'application/octet-stream',
  'text/csv',
];
// Le mimetype envoyé par le navigateur pour un même type de fichier varie selon l'OS/navigateur
// (ex. Windows+Chrome envoie souvent "application/x-zip-compressed" pour un .zip, ou
// "application/vnd.ms-excel" pour un .csv si Excel est associé) - une validation uniquement par
// mimetype rejette alors des fichiers pourtant valides. L'extension est donc vérifiée en premier
// (fiable et sous contrôle de l'utilisateur qui a nommé son fichier), le mimetype ne sert qu'en
// repli si l'extension est absente/inconnue.
const IMPORT_ALLOWED_EXTENSIONS = ['.geojson', '.json', '.kml', '.gpkg', '.zip', '.csv'];
const IMPORT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const QGIS_UPLOAD_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

function isAllowedImportFile(filename: string, mimetype: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return IMPORT_ALLOWED_EXTENSIONS.includes(ext) || IMPORT_ALLOWED_MIMETYPES.includes(mimetype);
}

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
const personalLayerIdParamSchema = z.object({
  instanceId: z.string().uuid(),
  id: z.string().uuid(),
});

/**
 * Données PRIVÉES d'un utilisateur (n'importe quel rôle, y compris VIEWER - voir
 * PersonalLayer/AlertingService pour le contexte) : import (fichier ou projet QGIS), gestion
 * CRUD, style, et demande de publication vers le catalogue partagé. La revue/validation admin
 * (SUPER_ADMIN/ADMIN_INSTANCE/EDITOR - même jeu de rôles que la création de couche catalogue,
 * puisqu'une approbation aboutit exactement à cette même action) vit dans ce même fichier de
 * routes car elle porte sur le même modèle PersonalLayer.
 */
export async function personalLayerRoutes(app: FastifyInstance): Promise<void> {
  const stageFileImportUseCase =
    app.diContainer.resolve<StageFileImportUseCase>('stageFileImportUseCase');
  const importPersonalFileUseCase = app.diContainer.resolve<ImportPersonalFileUseCase>(
    'importPersonalFileUseCase',
  );
  const importPersonalQgisProjectUseCase =
    app.diContainer.resolve<ImportPersonalQgisProjectUseCase>('importPersonalQgisProjectUseCase');
  const listMyPersonalLayersUseCase = app.diContainer.resolve<ListMyPersonalLayersUseCase>(
    'listMyPersonalLayersUseCase',
  );
  const deletePersonalLayerUseCase = app.diContainer.resolve<DeletePersonalLayerUseCase>(
    'deletePersonalLayerUseCase',
  );
  const getPersonalLayerFeaturesUseCase = app.diContainer.resolve<GetPersonalLayerFeaturesUseCase>(
    'getPersonalLayerFeaturesUseCase',
  );
  const applyPersonalLayerStyleUseCase = app.diContainer.resolve<ApplyPersonalLayerStyleUseCase>(
    'applyPersonalLayerStyleUseCase',
  );
  const requestPersonalLayerPublicationUseCase =
    app.diContainer.resolve<RequestPersonalLayerPublicationUseCase>(
      'requestPersonalLayerPublicationUseCase',
    );
  const listPendingPersonalLayerPublicationsUseCase =
    app.diContainer.resolve<ListPendingPersonalLayerPublicationsUseCase>(
      'listPendingPersonalLayerPublicationsUseCase',
    );
  const reviewPersonalLayerPublicationUseCase =
    app.diContainer.resolve<ReviewPersonalLayerPublicationUseCase>(
      'reviewPersonalLayerPublicationUseCase',
    );
  const uploadPersonalLayerQmlStyleUseCase =
    app.diContainer.resolve<UploadPersonalLayerQmlStyleUseCase>(
      'uploadPersonalLayerQmlStyleUseCase',
    );

  // GET / — mes données personnelles sur cette instance.
  app.get(
    '/',
    {
      schema: {
        description: 'Lister mes données personnelles sur cette instance',
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const result = await listMyPersonalLayersUseCase.execute(request.user.sub, instanceId);
      return reply.send(successResponse(result.map(toDto)));
    },
  );

  // POST /import/file — étape 1 : dépose un fichier géospatial en staging (aperçu), même
  // pipeline que le catalogue admin (voir StageFileImportUseCase).
  app.post(
    '/import/file',
    {
      schema: {
        description:
          'Importer un fichier géospatial personnel (multipart, champ "file") en staging - ' +
          'aperçu avant publication (voir POST /import/file/confirm).',
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
      },
      preHandler: [app.authenticate],
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
      if (!isAllowedImportFile(data.filename, data.mimetype)) {
        throw new ValidationError('Unsupported file type', {
          filename: data.filename,
          mimetype: data.mimetype,
        });
      }

      const dataDir = config.DATA_DIR;
      await mkdir(dataDir, { recursive: true });
      const ext = path.extname(data.filename) || '.geojson';
      const tmpPath = path.join(dataDir, `personal-import-${randomUUID()}${ext}`);
      await writeFile(tmpPath, buffer);

      try {
        const result = await stageFileImportUseCase.execute(tmpPath);
        return reply.send(successResponse(result));
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    },
  );

  // POST /import/file/confirm — étape 2 : promeut la table de staging en donnée PRIVÉE
  // (schema personal_data), avec thématique/sous-thématique/nom/style choisis par l'utilisateur.
  const confirmPersonalFileImportSchema = z.object({
    stagingTable: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    groupName: z.string().min(1),
    subGroupName: z.string().min(1),
    style: z
      .object({
        color: z.string().optional(),
        iconKey: z.string().optional(),
        shape: z.string().optional(),
      })
      .optional(),
  });
  app.post(
    '/import/file/confirm',
    {
      schema: {
        description: 'Confirmer et enregistrer une donnée personnelle importée depuis un fichier',
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(confirmPersonalFileImportSchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const dto = parseBody(confirmPersonalFileImportSchema, request.body);
      const result = await importPersonalFileUseCase.execute({
        userId: request.user.sub,
        instanceId,
        ...dto,
      });
      return reply.status(201).send(successResponse(toDto(result)));
    },
  );

  // POST /import/qgis-project — importe un projet QGIS complet en un coup : héberge le projet
  // sous un répertoire isolé par utilisateur puis crée une PersonalLayer par couche détectée
  // (thématique/sous-thématique et style natifs directement extraits du projet).
  app.post(
    '/import/qgis-project',
    {
      schema: {
        description: 'Importer un projet QGIS personnel complet (multipart, .qgz/.qgs/.zip)',
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const data = await request.file();
      if (!data) throw new ValidationError('No file uploaded', {});

      const buffer = await data.toBuffer();
      if (buffer.length > QGIS_UPLOAD_MAX_FILE_SIZE) {
        throw new ValidationError(
          `File too large. Maximum size is ${QGIS_UPLOAD_MAX_FILE_SIZE / 1024 / 1024}MB`,
          {},
        );
      }
      const ext = path.extname(data.filename).toLowerCase();
      if (ext !== '.qgz' && ext !== '.qgs' && ext !== '.zip') {
        throw new ValidationError(
          'Format de projet QGIS non supporté (.qgz, .qgs ou .zip attendu).',
          { filename: data.filename },
        );
      }

      const dataDir = config.DATA_DIR;
      await mkdir(dataDir, { recursive: true });
      const tmpPath = path.join(dataDir, `personal-qgis-upload-${randomUUID()}${ext}`);
      await writeFile(tmpPath, buffer);

      try {
        const result = await importPersonalQgisProjectUseCase.execute({
          userId: request.user.sub,
          instanceId,
          uploadedFilePath: tmpPath,
          originalFilename: data.filename,
        });
        return reply.status(201).send(successResponse(result.map(toDto)));
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    },
  );

  // GET /:id/features — features GeoJSON d'une donnée personnelle de type FILE (rendu client).
  app.get(
    '/:id/features',
    {
      schema: {
        description: "Obtenir les features GeoJSON d'une donnée personnelle",
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(personalLayerIdParamSchema, request.params);
      const result = await getPersonalLayerFeaturesUseCase.execute(request.user.sub, id);
      return reply.send(successResponse(result));
    },
  );

  // POST /:id/style — style couleur+icône d'une donnée personnelle de type FILE.
  const personalStyleSchema = z.object({
    color: z.string().optional(),
    iconKey: z.string().optional(),
    shape: z.string().optional(),
  });
  app.post(
    '/:id/style',
    {
      schema: {
        description: 'Appliquer un style couleur+icône à une donnée personnelle',
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(personalStyleSchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(personalLayerIdParamSchema, request.params);
      const dto = parseBody(personalStyleSchema, request.body);
      const result = await applyPersonalLayerStyleUseCase.execute({
        userId: request.user.sub,
        personalLayerId: id,
        ...dto,
      });
      return reply.send(successResponse(toDto(result)));
    },
  );

  // POST /:id/style/qml — stocke un style QML natif (exporté de QGIS Desktop), appliqué
  // seulement au moment de la publication (voir UploadPersonalLayerQmlStyleUseCase).
  app.post(
    '/:id/style/qml',
    {
      schema: {
        description:
          'Téléverser un style QML natif pour une donnée personnelle (appliqué à la publication)',
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(personalLayerIdParamSchema, request.params);
      const data = await request.file();
      if (!data) throw new ValidationError('No file uploaded', {});
      if (!data.filename.toLowerCase().endsWith('.qml')) {
        throw new ValidationError('Format de style non supporté (.qml attendu).', {
          filename: data.filename,
        });
      }

      const buffer = await data.toBuffer();
      const dataDir = config.DATA_DIR;
      await mkdir(dataDir, { recursive: true });
      const tmpPath = path.join(dataDir, `personal-qml-${randomUUID()}.qml`);
      await writeFile(tmpPath, buffer);

      try {
        const result = await uploadPersonalLayerQmlStyleUseCase.execute(
          request.user.sub,
          id,
          tmpPath,
        );
        return reply.send(successResponse(toDto(result)));
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    },
  );

  // DELETE /:id — supprime une donnée personnelle (table PostGIS ou projet QGIS privé + l'entrée).
  app.delete(
    '/:id',
    {
      schema: {
        description: 'Supprimer une donnée personnelle',
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(personalLayerIdParamSchema, request.params);
      await deletePersonalLayerUseCase.execute(request.user.sub, id);
      return reply.send(successResponse(null));
    },
  );

  // POST /:id/request-publication — demande de publication vers le catalogue partagé (alerte
  // Slack à l'équipe, voir RequestPersonalLayerPublicationUseCase).
  const requestPublicationSchema = z.object({ publicationNote: z.string().optional() });
  app.post(
    '/:id/request-publication',
    {
      schema: {
        description: "Demander la publication d'une donnée personnelle sur le catalogue",
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(requestPublicationSchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(personalLayerIdParamSchema, request.params);
      const { publicationNote } = parseBody(requestPublicationSchema, request.body);
      const result = await requestPersonalLayerPublicationUseCase.execute(
        request.user.sub,
        id,
        publicationNote,
      );
      return reply.send(successResponse(toDto(result)));
    },
  );

  // GET /publications/pending — file d'attente de modération (admin).
  app.get(
    '/publications/pending',
    {
      schema: {
        description: 'Lister les demandes de publication en attente sur cette instance',
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const result = await listPendingPersonalLayerPublicationsUseCase.execute(instanceId);
      return reply.send(successResponse(result.map(toDto)));
    },
  );

  // POST /:id/review — valide (avec override optionnel nom/thématique/sous-thématique) ou
  // refuse une demande de publication (admin).
  const reviewSchema = z.object({
    decision: z.enum(['APPROVE', 'REJECT']),
    reviewNote: z.string().optional(),
    overrideName: z.string().optional(),
    overrideGroupName: z.string().optional(),
    overrideSubGroupName: z.string().optional(),
  });
  app.post(
    '/:id/review',
    {
      schema: {
        description: 'Valider ou refuser une demande de publication',
        tags: ['Données personnelles'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(reviewSchema),
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(personalLayerIdParamSchema, request.params);
      const dto = parseBody(reviewSchema, request.body);
      const result = await reviewPersonalLayerPublicationUseCase.execute({
        reviewerId: request.user.sub,
        personalLayerId: id,
        ...dto,
      });
      return reply.send(successResponse(toDto(result)));
    },
  );
}
