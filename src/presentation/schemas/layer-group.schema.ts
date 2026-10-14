import { z } from 'zod';

export const createLayerGroupSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  order: z.number().int().optional(),
});

export const updateLayerGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const reorderLayerGroupsSchema = z.object({
  orders: z.array(z.object({ id: z.string().uuid(), order: z.number().int() })),
});
