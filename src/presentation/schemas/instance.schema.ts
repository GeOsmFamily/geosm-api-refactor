import { z } from 'zod';
import { Role } from '../../domain/enums.js';

export const listInstancesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().optional(),
  ),
});

// "schema.table" ou "table" - identifiants SQL simples uniquement. Ces valeurs sont ensuite
// interpolees dans du SQL brut (CreateOsmTableUseCase, SearchBoundariesUseCase, etc.) : on
// refuse tout caractere en dehors d'un identifiant SQL classique des la saisie, en plus du
// nettoyage deja applique cote use-case.
// Fonction plutot que constante partagee : zod-to-json-schema deduplique par reference d'objet
// et remplace la 2e occurrence par un "$ref" + "allOf" sans "type" propre, que le validateur de
// schema de Fastify rejette ensuite ("nullable" cannot be used without "type") - chaque champ a
// besoin de sa propre instance de schema.
const sqlIdentifier = () =>
  z
    .string()
    .max(128)
    .regex(/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)?$/, 'Identifiant SQL invalide');

export const createInstanceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  bbox: z.array(z.number()).optional(),
  centerLat: z.number().optional(),
  centerLon: z.number().optional(),
  defaultZoom: z.number().int().min(0).max(22).optional(),
  boundaryTable: sqlIdentifier().optional(),
  boundaryId: z.number().int().optional(),
  boundaryGeomCol: sqlIdentifier().optional(),
  adminLevel: z.number().int().optional(),
});

export const updateInstanceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  logo: z.string().url().nullable().optional(),
  bbox: z.array(z.number()).optional(),
  centerLat: z.number().nullable().optional(),
  centerLon: z.number().nullable().optional(),
  defaultZoom: z.number().int().min(0).max(22).optional(),
  boundaryTable: sqlIdentifier().nullable().optional(),
  boundaryId: z.number().int().nullable().optional(),
  boundaryGeomCol: sqlIdentifier().nullable().optional(),
  adminLevel: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const addInstanceUserSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(Role).optional(),
});

export const changeInstanceUserRoleSchema = z.object({
  role: z.nativeEnum(Role),
});
