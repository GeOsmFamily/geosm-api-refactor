import { z } from 'zod';
import { ExportFormat, JobStatus } from '../../domain/enums.js';

// Le PDF n'a pas de pilote OGR : le worker livrait un GeoPackage sous ce nom (constate en recette
// le 17 oct 2026). Le front ne le propose pas ; l'API le refuse plutot que de tromper.
const vectorExportFormat = z
  .nativeEnum(ExportFormat)
  .refine((f) => f !== ExportFormat.PDF, { message: 'Format PDF non disponible pour un export de couche' });

export const createExportSchema = z.object({
  format: vectorExportFormat,
  layerId: z.string().uuid(),
  bbox: z.array(z.number()).length(4).optional(),
  featureId: z.string().regex(/^\d+$/).optional(),
});

export const createBulkExportSchema = z.object({
  format: vectorExportFormat,
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
