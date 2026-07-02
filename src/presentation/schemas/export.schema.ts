import { z } from 'zod';
import { ExportFormat, JobStatus } from '../../domain/enums.js';

export const createExportSchema = z.object({
  format: z.nativeEnum(ExportFormat),
  layerId: z.string().uuid(),
  bbox: z.array(z.number()).length(4).optional(),
  featureId: z.string().regex(/^\d+$/).optional(),
});

export const createBulkExportSchema = z.object({
  format: z.nativeEnum(ExportFormat),
  layerIds: z.array(z.string().uuid()).min(1),
});

export const listExportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(JobStatus).optional(),
});

export const exportIdParamSchema = z.object({
  id: z.string().uuid(),
});
