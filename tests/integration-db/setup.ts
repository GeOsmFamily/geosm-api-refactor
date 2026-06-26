import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/geosm_test';

let prisma: PrismaClient | null = null;
let _dbAvailable: boolean | null = null;

/**
 * Synchronously check DB availability by attempting a connection.
 * Called once; result is cached.
 */
function checkDatabaseSync(): boolean {
  if (_dbAvailable !== null) return _dbAvailable;

  try {
    // Use a synchronous child process to probe the database
    execSync(
      `node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient({ datasources: { db: { url: '${DATABASE_URL}' } } }); p.$queryRawUnsafe('SELECT 1').then(() => { p.$disconnect(); process.exit(0); }).catch(() => { p.$disconnect(); process.exit(1); })"`,
      { cwd: process.cwd(), stdio: 'pipe', timeout: 10_000 },
    );
    _dbAvailable = true;
  } catch {
    console.warn(
      `\n⚠  Database not available at ${DATABASE_URL} — integration-db tests will be skipped.\n`,
    );
    _dbAvailable = false;
  }
  return _dbAvailable;
}

/**
 * Returns true if the database is reachable. Safe to call at module-level.
 */
export const DB_AVAILABLE: boolean = checkDatabaseSync();

/**
 * Returns true if the database is reachable (async version, uses cache).
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  return DB_AVAILABLE;
}

/**
 * Return (or create) the singleton PrismaClient used across all integration tests.
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  }
  return prisma;
}

/**
 * Run prisma db push so the schema is up-to-date.
 * Called once in a global beforeAll.
 */
export async function applyMigrations(): Promise<void> {
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL },
      stdio: 'pipe',
    });
  } catch (err) {
    // Fallback: try migrate deploy
    try {
      execSync('npx prisma migrate deploy', {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      console.error('Failed to apply migrations:', err);
      throw err;
    }
  }
}

/**
 * Delete all records from managed tables in reverse FK order.
 */
export async function cleanDatabase(): Promise<void> {
  const p = getPrisma();
  // Order matters: children before parents
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

/**
 * Disconnect prisma when all tests are done.
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
