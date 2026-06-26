import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/geosm_test';

export default async function globalSetup() {
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    process.env.__DB_AVAILABLE__ = 'true';

    // Apply schema
    execSync(
      'npx prisma db push --skip-generate --accept-data-loss --schema=src/infrastructure/database/prisma/schema.prisma',
      { cwd: process.cwd(), env: { ...process.env, DATABASE_URL }, stdio: 'pipe' },
    );
  } catch {
    console.warn(`\n⚠  Database not available at ${DATABASE_URL}\n`);
    process.env.__DB_AVAILABLE__ = 'false';
  } finally {
    await prisma.$disconnect();
  }
}
