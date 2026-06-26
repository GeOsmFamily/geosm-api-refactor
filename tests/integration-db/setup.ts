import { PrismaClient } from '@prisma/client';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/geosm_test';

let prisma: PrismaClient | null = null;

export const DB_AVAILABLE: boolean = process.env.__DB_AVAILABLE__ === 'true';

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  }
  return prisma;
}

export async function cleanDatabase(): Promise<void> {
  const p = getPrisma();
  await p.$executeRawUnsafe('DELETE FROM "exports"');
  await p.$executeRawUnsafe('DELETE FROM "layer_actions"');
  await p.$executeRawUnsafe('DELETE FROM "layer_styles"');
  await p.$executeRawUnsafe('DELETE FROM "layers"');
  await p.$executeRawUnsafe('DELETE FROM "sub_groups"');
  await p.$executeRawUnsafe('DELETE FROM "groups"');
  await p.$executeRawUnsafe('DELETE FROM "qgis_projects"');
  await p.$executeRawUnsafe('DELETE FROM "base_maps"');
  await p.$executeRawUnsafe('DELETE FROM "documents"');
  await p.$executeRawUnsafe('DELETE FROM "map_compositions"');
  await p.$executeRawUnsafe('DELETE FROM "shared_maps"');
  await p.$executeRawUnsafe('DELETE FROM "drawings"');
  await p.$executeRawUnsafe('DELETE FROM "analytics_events"');
  await p.$executeRawUnsafe('DELETE FROM "default_tags"');
  await p.$executeRawUnsafe('DELETE FROM "default_themes"');
  await p.$executeRawUnsafe('DELETE FROM "instance_users"');
  await p.$executeRawUnsafe('DELETE FROM "refresh_tokens"');
  await p.$executeRawUnsafe('DELETE FROM "instances"');
  await p.$executeRawUnsafe('DELETE FROM "users"');
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
