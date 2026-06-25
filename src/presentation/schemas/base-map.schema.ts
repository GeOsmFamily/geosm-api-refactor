import { z } from 'zod';
import { BaseMapType } from '../../domain/enums.js';

export const createBaseMapSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  type: z.nativeEnum(BaseMapType),
  url: z.string().url(),
  thumbnail: z.string().url().optional(),
  attribution: z.string().optional(),
  isDefault: z.boolean().optional(),
  order: z.number().int().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateBaseMapSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  thumbnail: z.string().url().nullable().optional(),
  attribution: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  order: z.number().int().optional(),
  config: z.record(z.unknown()).nullable().optional(),
});
