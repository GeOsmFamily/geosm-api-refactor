import { z } from 'zod';

export const globalSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().optional(),
});

export const searchLayersQuerySchema = z.object({
  q: z.string().min(1),
  instanceId: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const searchFeaturesQuerySchema = z.object({
  q: z.string().min(1),
  layerId: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
export type SearchLayersQuery = z.infer<typeof searchLayersQuerySchema>;
export type SearchFeaturesQuery = z.infer<typeof searchFeaturesQuerySchema>;
