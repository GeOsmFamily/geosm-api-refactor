import { z } from 'zod';

export const createDefaultThemeSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  icon: z.string().max(255).optional(),
  color: z.string().max(50).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateDefaultThemeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  icon: z.string().max(255).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

export const createDefaultTagSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
});
