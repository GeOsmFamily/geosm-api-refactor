import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { UploadRasterUseCase } from '../../application/use-cases/rasters/upload-raster.use-case.js';
import { DownloadRasterUseCase } from '../../application/use-cases/rasters/download-raster.use-case.js';
import { RasterService } from '../../infrastructure/gdal/raster.service.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const downloadSchema = z.object({
  tableName: z.string().min(1),
  format: z.string().default('GTiff'),
});

export async function rasterRoutes(app: FastifyInstance): Promise<void> {
  const uploadRasterUseCase = app.diContainer.resolve<UploadRasterUseCase>('uploadRasterUseCase');
  const downloadRasterUseCase = app.diContainer.resolve<DownloadRasterUseCase>('downloadRasterUseCase');
  const rasterService = app.diContainer.resolve<RasterService>('rasterService');

  // POST /rasters/upload
  app.post('/upload', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const file = await request.file();
    if (!file) return reply.status(400).send({ success: false, message: 'No file uploaded' });
    const fields = file.fields as Record<string, { value?: string }>;
    const tableName = fields.tableName?.value ?? 'raster_import';
    const sridStr = fields.srid?.value;
    const srid = sridStr ? parseInt(sridStr) : undefined;
    const path = await import('path');
    const fs = await import('fs/promises');
    const tmpDir = process.env.DATA_DIR || '/tmp/geosm-data';
    const tmpPath = path.default.join(tmpDir, `upload_${Date.now()}_${file.filename}`);
    const fsModule = await import('fs');
    if (!fsModule.existsSync(tmpDir)) await fs.mkdir(tmpDir, { recursive: true });
    const buffer = await file.toBuffer();
    await fs.writeFile(tmpPath, buffer);
    try {
      const result = await uploadRasterUseCase.execute(tmpPath, tableName, { srid });
      return reply.status(201).send(successResponse(result));
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  });

  // POST /rasters/download
  app.post('/download', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tableName, format } = parseBody(downloadSchema, request.body);
    const result = await downloadRasterUseCase.execute(tableName, format);
    return reply.send(successResponse(result));
  });

  // POST /rasters/info
  app.post('/info', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { filePath } = parseBody(z.object({ filePath: z.string().min(1) }), request.body);
    const info = await rasterService.getRasterInfo(filePath);
    return reply.send(successResponse(info));
  });
}
