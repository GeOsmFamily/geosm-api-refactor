import { z } from 'zod';
import { GeometryType, SourceType } from '../../domain/enums.js';

export const listLayersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  geometryType: z.nativeEnum(GeometryType).optional(),
  subGroupId: z.string().uuid().optional(),
});

export const createLayerSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  geometryType: z.nativeEnum(GeometryType),
  sourceType: z.nativeEnum(SourceType),
  sourceUrl: z.string().optional(),
  sourceLayer: z.string().optional(),
  tableName: z.string().optional(),
  schemaName: z.string().optional(),
  minZoom: z.number().int().min(0).max(22).optional(),
  maxZoom: z.number().int().min(0).max(22).optional(),
  isVisible: z.boolean().optional(),
  isQueryable: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
  order: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
  subGroupId: z.string().uuid(),
});

export const updateLayerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  sourceLayer: z.string().nullable().optional(),
  tableName: z.string().nullable().optional(),
  schemaName: z.string().nullable().optional(),
  minZoom: z.number().int().min(0).max(22).optional(),
  maxZoom: z.number().int().min(0).max(22).optional(),
  isVisible: z.boolean().optional(),
  isQueryable: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
  order: z.number().int().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});
