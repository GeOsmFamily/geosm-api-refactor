import { z } from 'zod';

export const routeQuerySchema = z.object({
  coordinates: z.string().min(1),
  profile: z.string().optional().default('driving'),
  alternatives: z.coerce.boolean().optional(),
  steps: z.coerce.boolean().optional(),
  geometries: z.string().optional(),
});

export const nearestQuerySchema = z.object({
  lon: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  number: z.coerce.number().int().positive().optional(),
});

export type RouteQuery = z.infer<typeof routeQuerySchema>;
export type NearestQuery = z.infer<typeof nearestQuerySchema>;
