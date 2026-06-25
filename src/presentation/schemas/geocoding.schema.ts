import { z } from 'zod';

export const searchGeocodingQuerySchema = z.object({
  q: z.string().min(1),
  viewbox: z.string().optional(),
  bounded: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().optional(),
  countrycodes: z.string().optional(),
});

export const reverseGeocodingQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export const lookupGeocodingQuerySchema = z.object({
  osm_ids: z.string().min(1),
});

export type SearchGeocodingQuery = z.infer<typeof searchGeocodingQuerySchema>;
export type ReverseGeocodingQuery = z.infer<typeof reverseGeocodingQuerySchema>;
export type LookupGeocodingQuery = z.infer<typeof lookupGeocodingQuerySchema>;
