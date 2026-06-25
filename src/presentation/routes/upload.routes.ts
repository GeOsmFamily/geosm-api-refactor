import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import type { ImportLayerUseCase } from '../../application/use-cases/layers/import-layer.use-case.js';
import type { DownloadExportUseCase } from '../../application/use-cases/exports/download-export.use-case.js';

const ALLOWED_MIMETYPES = [
  'application/json',
  'application/geo+json',
  'application/x-shapefile',
  'application/geopackage+sqlite3',
  'application/vnd.google-earth.kml+xml',
  'text/csv',
  'application/zip',
  'application/octet-stream',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function detectFormat(filename: string, mimetype: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'geojson':
    case 'json': return 'GEOJSON';
    case 'shp':
    case 'zip': return 'SHAPEFILE';
    case 'gpkg': return 'GEOPACKAGE';
    case 'kml': return 'KML';
    case 'csv': return 'CSV';
    default:
      if (mimetype.includes('json')) return 'GEOJSON';
      if (mimetype.includes('kml')) return 'KML';
      if (mimetype.includes('csv')) return 'CSV';
      return 'GEOJSON';
  }
}

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  const importLayerUseCase = app.diContainer.resolve<ImportLayerUseCase>('importLayerUseCase');
  const downloadExportUseCase = app.diContainer.resolve<DownloadExportUseCase>('downloadExportUseCase');

  // POST /layers/:layerId/import — Upload and import a geospatial file
  app.post('/:layerId/import', {
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = z.object({ layerId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) throw new ValidationError('Invalid layer ID', params.error.format() as Record<string, unknown>);

    const data = await request.file();
    if (!data) throw new ValidationError('No file uploaded', {});

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_FILE_SIZE) throw new ValidationError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, {});

    if (!ALLOWED_MIMETYPES.includes(data.mimetype) && data.mimetype !== 'application/octet-stream') {
      throw new ValidationError('Unsupported file type', { mimetype: data.mimetype });
    }

    const format = detectFormat(data.filename, data.mimetype);
    const user = request.user as { sub: string };

    const result = await importLayerUseCase.execute({
      layerId: params.data.layerId,
      userId: user.sub!,
      fileBuffer: buffer,
      filename: data.filename,
      mimetype: data.mimetype,
      format,
    });

    return reply.status(202).send(successResponse(result));
  });

  // GET /exports/:exportId/download — Get presigned download URL
  app.get('/exports/:exportId/download', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = z.object({ exportId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) throw new ValidationError('Invalid export ID', params.error.format() as Record<string, unknown>);

    const user = request.user as { sub: string };
    const result = await downloadExportUseCase.execute(params.data.exportId, user.sub);
    return reply.send(successResponse(result));
  });
}
