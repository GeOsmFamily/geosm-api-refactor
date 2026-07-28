import { z } from 'zod';
import { BaseMapType } from '../../domain/enums.js';

// Les URL de fond de carte (XYZ/WMS/WMTS) sont des *templates* contenant des
// placeholders littéraux comme {z}/{x}/{y}/{-y}/{a-c}, invalides au sens strict de
// l'URI RFC 3986 utilisé par `z.string().url()` (format "uri" côté AJV, plus strict que
// le WHATWG URL parser). Un `.url()` classique rejette donc toute URL de fond de carte
// XYZ légitime dès qu'elle contient ces accolades.
const tileUrlSchema = z
  .string()
  .min(1)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'url must start with http:// or https://',
  });

export const createBaseMapSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  type: z.nativeEnum(BaseMapType),
  url: tileUrlSchema,
  thumbnail: z.string().url().nullable().optional(),
  attribution: z.string().optional(),
  isDefault: z.boolean().optional(),
  order: z.number().int().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateBaseMapSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: tileUrlSchema.optional(),
  thumbnail: z.string().url().nullable().optional(),
  attribution: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  order: z.number().int().optional(),
  config: z.record(z.unknown()).nullable().optional(),
});
