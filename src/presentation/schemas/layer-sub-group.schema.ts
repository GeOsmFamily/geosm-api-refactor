import { z } from 'zod';

export const createLayerSubGroupSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().optional(),
});

export const updateLayerSubGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
