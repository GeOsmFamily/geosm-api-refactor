import { execSync } from 'child_process';

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) return;

  try {
    execSync(
      'npx prisma db push --skip-generate --accept-data-loss --schema=src/infrastructure/database/prisma/schema.prisma',
      { cwd: process.cwd(), stdio: 'pipe' },
    );
  } catch (err) {
    console.warn('⚠  Failed to apply DB schema in globalSetup:', err);
  }
}
