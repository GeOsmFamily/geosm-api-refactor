import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

export async function rasterRoutes(app: FastifyInstance): Promise<void> {
  const uploadRasterUseCase = app.diContainer.resolve<UploadRasterUseCase>('uploadRasterUseCase');
  const downloadRasterUseCase =
    app.diContainer.resolve<DownloadRasterUseCase>('downloadRasterUseCase');
  const rasterService = app.diContainer.resolve<RasterService>('rasterService');

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
      const file = await request.file();
      if (!file) throw new ValidationError('No file uploaded', {});

      const rawFields = Object.fromEntries(
        Object.entries(file.fields)
          .filter(([, v]) => v && typeof v === 'object' && 'value' in v)
          .map(([k, v]) => [k, (v as { value: unknown }).value]),
      );
      const { tableName, name, description, instanceId, subGroupId, srid } = parseBody(
        uploadFieldsSchema,
        rawFields,
      );

      const tmpDir = config.DATA_DIR;
      if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `upload_${randomUUID()}_${file.filename}`);
      const buffer = await file.toBuffer();
      await writeFile(tmpPath, buffer);

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
}
