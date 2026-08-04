import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { config } from '../../config/env.config.js';

import { UploadRasterUseCase } from '../../application/use-cases/rasters/upload-raster.use-case.js';
import { DownloadRasterUseCase } from '../../application/use-cases/rasters/download-raster.use-case.js';
import { RasterService } from '../../infrastructure/gdal/raster.service.js';
import {
  RunRasterAnalysisUseCase,
  type RasterAnalysisType,
} from '../../application/use-cases/rasters/run-raster-analysis.use-case.js';
import { GetRasterAnalysisResultUseCase } from '../../application/use-cases/rasters/get-raster-analysis-result.use-case.js';
import { GetPixelValueUseCase } from '../../application/use-cases/rasters/get-pixel-value.use-case.js';

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

const downloadSchema = z.object({
  tableName: z.string().min(1),
  format: z.string().default('GTiff'),
});

const analyzeBodySchema = z.object({
  type: z.enum(['global', 'zonal']),
});

const pixelValueQuerySchema = z.object({
  lon: z.coerce.number(),
  lat: z.coerce.number(),
});

export async function rasterRoutes(app: FastifyInstance): Promise<void> {
  const uploadRasterUseCase = app.diContainer.resolve<UploadRasterUseCase>('uploadRasterUseCase');
  const downloadRasterUseCase =
    app.diContainer.resolve<DownloadRasterUseCase>('downloadRasterUseCase');
  const rasterService = app.diContainer.resolve<RasterService>('rasterService');
  const runRasterAnalysisUseCase = app.diContainer.resolve<RunRasterAnalysisUseCase>(
    'runRasterAnalysisUseCase',
  );
  const getRasterAnalysisResultUseCase = app.diContainer.resolve<GetRasterAnalysisResultUseCase>(
    'getRasterAnalysisResultUseCase',
  );
  const getPixelValueUseCase =
    app.diContainer.resolve<GetPixelValueUseCase>('getPixelValueUseCase');

  // POST /rasters/upload — importe un raster ET le rend visible sur le portail (voir
  // UploadRasterUseCase : enregistrement dans le projet QGIS + création d'une couche).
  const uploadFieldsSchema = z.object({
    tableName: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    instanceId: z.string().uuid(),
    subGroupId: z.string().uuid(),
    srid: z.coerce.number().int().optional(),
  });
  app.post(
    '/upload',
    {
      schema: {
        description: 'Telecharger un fichier raster (multipart)',
        tags: ['Rasters'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // request.file() ne renvoie que les champs déjà lus dans le flux multipart AVANT le
      // fichier (file.fields ne contient jamais ceux qui suivent) - le frontend (RasterService)
      // envoie justement 'file' en premier dans le FormData, donc tableName/name/instanceId/
      // subGroupId remontaient systématiquement comme "Required" (vérifié en conditions réelles :
      // l'upload échouait toujours, quel que soit le raster). request.parts() itère tout le
      // flux sans cette dépendance à l'ordre d'envoi.
      const tmpDir = config.DATA_DIR;
      if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

      let tmpPath: string | null = null;
      const rawFields: Record<string, unknown> = {};

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          tmpPath = path.join(tmpDir, `upload_${randomUUID()}_${part.filename}`);
          // Flux directement vers le disque plutôt que file.toBuffer() - un raster peut
          // atteindre plusieurs centaines de Mo (voir la limite de 2GB dans multipart.plugin.ts),
          // le bufferiser entièrement en mémoire avant écriture aggraverait la pression mémoire
          // qui a déjà fait tuer gdalwarp par l'OOM killer du conteneur (voir docker-compose.yml).
          await pipeline(part.file, createWriteStream(tmpPath));
        } else {
          rawFields[part.fieldname] = part.value;
        }
      }

      if (!tmpPath) throw new ValidationError('No file uploaded', {});

      const { tableName, name, description, instanceId, subGroupId, srid } = parseBody(
        uploadFieldsSchema,
        rawFields,
      );

      try {
        const result = await uploadRasterUseCase.execute({
          filePath: tmpPath,
          tableName,
          name,
          description,
          instanceId,
          subGroupId,
          srid,
        });
        return reply.status(201).send(successResponse(result));
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    },
  );

  // POST /rasters/download
  app.post(
    '/download',
    {
      schema: {
        description: 'Telecharger un raster',
        tags: ['Rasters'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(downloadSchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tableName, format } = parseBody(downloadSchema, request.body);
      const result = await downloadRasterUseCase.execute(tableName, format);
      return reply.send(successResponse(result));
    },
  );

  // POST /rasters/info
  app.post(
    '/info',
    {
      schema: {
        description: "Obtenir les informations d'un raster",
        tags: ['Rasters'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { filePath } = parseBody(z.object({ filePath: z.string().min(1) }), request.body);
      const info = await rasterService.getRasterInfo(filePath);
      return reply.send(successResponse(info));
    },
  );

  // POST /rasters/:layerId/analyze — déclenche une analyse asynchrone (statistiques globales ou
  // zonales, voir plan "Analyse raster"). Retourne un resultId à interroger via
  // GET /rasters/analysis/:resultId (polling côté frontend).
  app.post(
    '/:layerId/analyze',
    {
      schema: {
        description: 'Déclencher une analyse raster (job asynchrone)',
        tags: ['Rasters'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(analyzeBodySchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { layerId } = parseBody(z.object({ layerId: z.string().uuid() }), request.params);
      const { type } = parseBody(analyzeBodySchema, request.body);
      const result = await runRasterAnalysisUseCase.execute(layerId, type as RasterAnalysisType);
      return reply.status(202).send(successResponse(result));
    },
  );

  // GET /rasters/analysis/:resultId — statut/résultat d'un job d'analyse (polling).
  app.get(
    '/analysis/:resultId',
    {
      schema: {
        description: "Obtenir le statut/résultat d'une analyse raster",
        tags: ['Rasters'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { resultId } = parseBody(z.object({ resultId: z.string().uuid() }), request.params);
      const result = await getRasterAnalysisResultUseCase.execute(resultId);
      return reply.send(successResponse(result));
    },
  );

  // GET /rasters/:layerId/value?lon=&lat= — valeur du pixel au clic, synchrone.
  app.get(
    '/:layerId/value',
    {
      schema: {
        description: "Obtenir la valeur d'un pixel raster à un point donné",
        tags: ['Rasters'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(pixelValueQuerySchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { layerId } = parseBody(z.object({ layerId: z.string().uuid() }), request.params);
      const { lon, lat } = parseBody(pixelValueQuerySchema, request.query);
      const result = await getPixelValueUseCase.execute(layerId, lon, lat);
      return reply.send(successResponse(result));
    },
  );
}
