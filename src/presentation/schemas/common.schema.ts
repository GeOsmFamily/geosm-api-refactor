import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const slugParamSchema = z.object({
  slug: z.string().min(1),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type SlugParam = z.infer<typeof slugParamSchema>;

export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true as const,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

export function paginatedResponse<T>(data: T[], meta: { page: number; limit: number; total: number; totalPages: number }) {
  return {
    success: true as const,
    data,
    meta: {
      pagination: meta,
      timestamp: new Date().toISOString(),
    },
  };
}
