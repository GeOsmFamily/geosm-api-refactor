import { z } from 'zod';
import { Role } from '../../domain/enums.js';

export const listInstancesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.preprocess(v => v === 'true' ? true : v === 'false' ? false : v, z.boolean().optional()),
});

export const createInstanceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  bbox: z.array(z.number()).optional(),
  centerLat: z.number().optional(),
  centerLon: z.number().optional(),
  defaultZoom: z.number().int().min(0).max(22).optional(),
});

export const updateInstanceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  logo: z.string().url().nullable().optional(),
  bbox: z.array(z.number()).optional(),
  centerLat: z.number().nullable().optional(),
  centerLon: z.number().nullable().optional(),
  defaultZoom: z.number().int().min(0).max(22).optional(),
  isActive: z.boolean().optional(),
});

export const addInstanceUserSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(Role).optional(),
});

export const changeInstanceUserRoleSchema = z.object({
  role: z.nativeEnum(Role),
});
