import { z } from 'zod';
import { PaperSize, PlanOrientation } from '../../domain/enums.js';

export const createLocationPlanSchema = z.object({
  instanceId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  landmark: z.string().optional(),
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  scale: z.number().int().positive().optional(),
  paperSize: z.nativeEnum(PaperSize).optional(),
  orientation: z.nativeEnum(PlanOrientation).optional(),
  includeLegend: z.boolean().optional(),
  includeScale: z.boolean().optional(),
  includeGrid: z.boolean().optional(),
  includeNorthArrow: z.boolean().optional(),
});

export const locationPlanIdParamSchema = z.object({
  id: z.string().uuid(),
});
