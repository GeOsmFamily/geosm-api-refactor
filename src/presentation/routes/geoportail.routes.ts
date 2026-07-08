import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import type { PostGISService } from '../../infrastructure/database/postgis.service.js';
import { GetLayerStatsUseCase } from '../../application/use-cases/layers/get-layer-stats.use-case.js';
import { FindAdminBoundaryUseCase } from '../../application/use-cases/geoportail/find-admin-boundary.use-case.js';
import { GeolocateIpUseCase } from '../../application/use-cases/geoportail/geolocate-ip.use-case.js';
import { SearchLimitInTableUseCase } from '../../application/use-cases/geoportail/search-limit-in-table.use-case.js';
import { SaveCoordPdfUseCase } from '../../application/use-cases/maps/save-coord-pdf.use-case.js';
import { resolveLang } from '../utils/lang.util.js';
import { SummarizeViewportUseCase } from '../../application/use-cases/geoportail/summarize-viewport.use-case.js';
import { SearchBoundariesUseCase } from '../../application/use-cases/geoportail/search-boundaries.use-case.js';
import { GetBoundaryUseCase } from '../../application/use-cases/geoportail/get-boundary.use-case.js';
import { ImportBoundariesUseCase } from '../../application/use-cases/geoportail/import-boundaries.use-case.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';

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

const altitudeBodySchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

const elevationProfileBodySchema = z.object({
  geometry: z.record(z.unknown()),
  numPoints: z.number().int().min(2).max(1000).default(100),
});

const layerIdParamSchema = z.object({ layerId: z.string().uuid() });

const layerStatsQuerySchema = z.object({
  narrative: z.coerce.boolean().optional().default(false),
});

const summarizeViewBodySchema = z.object({
  layerIds: z.array(z.string().uuid()).min(1).max(50),
});

const adminBoundaryQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  table: z.string().optional(),
});

const searchLimitQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  table: z.string().min(1),
});

const saveCoordPdfSchema = z.object({
  instanceId: z.string().uuid(),
  coordinates: z.array(z.object({ lat: z.number(), lon: z.number() })),
  title: z.string().optional(),
  description: z.string().optional(),
});

const searchBoundariesQuerySchema = z.object({
  table: z.string().min(1),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const getBoundaryParamsSchema = z.object({
  table: z.string().min(1),
  id: z.coerce.number().int(),
});

const getBoundaryQuerySchema = z.object({
  geomCol: z.string().optional(),
});

const IMPORT_ALLOWED_MIMETYPES = [
  'application/json',
  'application/geo+json',
  'application/x-shapefile',
  'application/zip',
  'application/octet-stream',
];
const IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB - largement suffisant pour un shapefile/GeoJSON de limites administratives

export async function geoportailRoutes(app: FastifyInstance): Promise<void> {
  const postGISService = app.diContainer.resolve<PostGISService>('postGISService');
  const getLayerStatsUseCase =
    app.diContainer.resolve<GetLayerStatsUseCase>('getLayerStatsUseCase');
  const findAdminBoundaryUseCase = app.diContainer.resolve<FindAdminBoundaryUseCase>(
    'findAdminBoundaryUseCase',
  );
  const geolocateIpUseCase = app.diContainer.resolve<GeolocateIpUseCase>('geolocateIpUseCase');
  const searchBoundariesUseCase =
    app.diContainer.resolve<SearchBoundariesUseCase>('searchBoundariesUseCase');
  const getBoundaryUseCase = app.diContainer.resolve<GetBoundaryUseCase>('getBoundaryUseCase');
  const importBoundariesUseCase =
    app.diContainer.resolve<ImportBoundariesUseCase>('importBoundariesUseCase');
  const searchLimitInTableUseCase = app.diContainer.resolve<SearchLimitInTableUseCase>(
    'searchLimitInTableUseCase',
  );
  const saveCoordPdfUseCase = app.diContainer.resolve<SaveCoordPdfUseCase>('saveCoordPdfUseCase');
  const summarizeViewportUseCase = app.diContainer.resolve<SummarizeViewportUseCase>(
    'summarizeViewportUseCase',
  );

  // POST /api/v1/geoportail/altitude
  app.post(
    '/altitude',
    {
      schema: {
        description: "Obtenir l'altitude d'un point",
        tags: ['Geoportail'],
        body: zodToSwagger(altitudeBodySchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { lon, lat } = parseBody(altitudeBodySchema, request.body);
      const altitude = await postGISService.getAltitude(lon, lat);
      return reply.send(successResponse({ lon, lat, altitude }));
    },
  );

  // POST /api/v1/geoportail/elevation-profile
  app.post(
    '/elevation-profile',
    {
      schema: {
        description: 'Obtenir le profil altimetrique',
        tags: ['Geoportail'],
        body: zodToSwagger(elevationProfileBodySchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { geometry, numPoints } = parseBody(elevationProfileBodySchema, request.body);
      const profile = await postGISService.drapeElevationProfile(
        JSON.stringify(geometry),
        numPoints,
      );
      return reply.send(successResponse({ profile }));
    },
  );

  // GET /api/v1/geoportail/admin-boundary?lat=X&lon=Y&table=optional
  app.get(
    '/admin-boundary',
    {
      schema: {
        description: 'Trouver les limites administratives',
        tags: ['Geoportail'],
        querystring: zodToSwagger(adminBoundaryQuerySchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { lat, lon, table } = parseBody(adminBoundaryQuerySchema, request.query);
      const boundaries = await findAdminBoundaryUseCase.execute(lat, lon, table);
      return reply.send(successResponse(boundaries));
    },
  );

  // GET /api/v1/geoportail/geolocate
  app.get(
    '/geolocate',
    {
      schema: { description: 'Geolocaliser par adresse IP', tags: ['Geoportail'] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await geolocateIpUseCase.execute(request.ip);
      return reply.send(successResponse(result));
    },
  );

  // POST /api/v1/layers/:layerId/stats?narrative=true
  // narrative=true ajoute une synthese textuelle generee par IA (Gemini) en plus des
  // chiffres bruts - echoue silencieusement (pas de champ `narrative` dans la reponse) si
  // GEMINI_API_KEY est absente ou l'appel echoue, voir GetLayerStatsUseCase.
  app.post(
    '/layers/:layerId/stats',
    {
      schema: {
        description: "Obtenir les statistiques d'une couche",
        tags: ['Geoportail'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(layerStatsQuerySchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { layerId } = parseBody(layerIdParamSchema, request.params);
      const { narrative } = parseBody(layerStatsQuerySchema, request.query);
      const stats = await getLayerStatsUseCase.execute(layerId, narrative, resolveLang(request));
      return reply.send(successResponse(stats));
    },
  );

  // POST /api/v1/geoportail/summarize-view
  // Agrège les statistiques des couches actives passées en corps de requête et les
  // transforme en un court paragraphe via Gemini (voir SummarizeViewportUseCase). Renvoie
  // les statistiques agrégées même si la synthèse IA échoue (champ `narrative` absent).
  app.post(
    '/summarize-view',
    {
      schema: {
        description: 'Résumer la vue courante (couches actives)',
        tags: ['Geoportail'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(summarizeViewBodySchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { layerIds } = parseBody(summarizeViewBodySchema, request.body);
      const summary = await summarizeViewportUseCase.execute(layerIds);
      return reply.send(successResponse(summary));
    },
  );

  // GET /api/v1/geoportail/search-limit?lat=X&lon=Y&table=schema.table
  app.get(
    '/search-limit',
    {
      schema: {
        description: 'Rechercher les limites dans une table',
        tags: ['Geoportail'],
        querystring: zodToSwagger(searchLimitQuerySchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { lat, lon, table } = parseBody(searchLimitQuerySchema, request.query);
      const results = await searchLimitInTableUseCase.execute(table, lat, lon);
      return reply.send(successResponse(results));
    },
  );

  // POST /api/v1/geoportail/save-coord-pdf
  app.post(
    '/save-coord-pdf',
    {
      schema: {
        description: 'Sauvegarder les coordonnees en PDF',
        tags: ['Geoportail'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(saveCoordPdfSchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const input = parseBody(saveCoordPdfSchema, request.body);
      const userId = (request.user as { sub: string }).sub;
      const result = await saveCoordPdfUseCase.execute({ ...input, userId });
      return reply.status(201).send(successResponse(result));
    },
  );

  // GET /api/v1/geoportail/admin-boundaries/search?table=admin_boundaries&q=Camer
  // Réservé aux rôles admin (contrairement à /admin-boundary et /search-limit, publics) : sert
  // le sélecteur de limite administrative utilisé lors de la création/édition d'une instance
  // (Instance.boundaryTable/boundaryId), pas une fonctionnalité grand public de la carte.
  app.get(
    '/admin-boundaries/search',
    {
      schema: {
        description: 'Rechercher une limite administrative par nom',
        tags: ['Geoportail'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(searchBoundariesQuerySchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { table, q, limit } = parseBody(searchBoundariesQuerySchema, request.query);
      const results = await searchBoundariesUseCase.execute(table, q, limit);
      return reply.send(successResponse(results));
    },
  );

  // GET /api/v1/geoportail/admin-boundaries/:table/:id - apercu geometrique (utilise apres
  // selection d'un resultat de recherche ci-dessus, pas pour lister/parcourir).
  app.get(
    '/admin-boundaries/:table/:id',
    {
      schema: {
        description: "Obtenir le detail (geometrie incluse) d'une limite administrative",
        tags: ['Geoportail'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { table, id } = parseBody(getBoundaryParamsSchema, request.params);
      const { geomCol } = parseBody(getBoundaryQuerySchema, request.query);
      const boundary = await getBoundaryUseCase.execute(table, id, geomCol);
      if (!boundary) {
        return reply
          .status(404)
          .send({ success: false, message: `Boundary ${id} not found in ${table}` });
      }
      return reply.send(successResponse(boundary));
    },
  );

  // POST /api/v1/geoportail/admin-boundaries/import (multipart) - shapefile (.zip) ou GeoJSON,
  // réservé SUPER_ADMIN (import.mode='replace' peut supprimer des données existantes - plus
  // sensible que la simple recherche/consultation ci-dessus, ouverte à ADMIN_INSTANCE aussi).
  app.post(
    '/admin-boundaries/import',
    {
      schema: {
        description: 'Importer des limites administratives (shapefile/GeoJSON)',
        tags: ['Geoportail'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
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

      const fieldsSchema = z.object({
        nameField: z.string().min(1),
        adminLevel: z.coerce.number().int(),
        mode: z.enum(['append', 'replace']).default('append'),
      });
      const rawFields = Object.fromEntries(
        Object.entries(data.fields)
          .filter(([, v]) => v && typeof v === 'object' && 'value' in v)
          .map(([k, v]) => [k, (v as { value: unknown }).value]),
      );
      const { nameField, adminLevel, mode } = parseBody(fieldsSchema, rawFields);

      const dataDir = process.env.DATA_DIR || '/tmp/geosm-data';
      await mkdir(dataDir, { recursive: true });
      const ext = path.extname(data.filename) || '.geojson';
      const tmpPath = path.join(dataDir, `boundary-import-${randomUUID()}${ext}`);
      await writeFile(tmpPath, buffer);

      try {
        const result = await importBoundariesUseCase.execute({
          filePath: tmpPath,
          nameField,
          adminLevel,
          mode,
        });
        return reply.send(successResponse(result));
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    },
  );
}
