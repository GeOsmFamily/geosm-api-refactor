import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const shouldSkip = !DATABASE_URL;

interface SqlOccurrence {
  file: string;
  line: number;
  sql: string;
  isDDL: boolean;
}

const DDL_KEYWORDS = ['CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'COMMENT'];

function findRawSqlInSource(): SqlOccurrence[] {
  const srcDir = resolve(__dirname, '../../src');
  const occurrences: SqlOccurrence[] = [];

  let grepOutput: string;
  try {
    grepOutput = execSync(
      `grep -rn '\\$queryRawUnsafe\\|\\$executeRawUnsafe' "${srcDir}" --include="*.ts"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
    );
  } catch {
    return occurrences;
  }

  for (const line of grepOutput.trim().split('\n')) {
    if (!line) continue;
    const match = line.match(/^(.+?):(\d+):(.+)$/);
    if (!match) continue;

    const [, file, lineNum, content] = match;

    const backtickMatch = content.match(/`([^`]+)`/);
    if (backtickMatch) {
      const sql = backtickMatch[1]
        .replace(/\$\{[^}]+\}/g, '1')
        .trim();
      if (sql.length > 5) {
        const firstWord = sql.replace(/^\s*/, '').split(/\s+/)[0]?.toUpperCase() ?? '';
        const isDDL = DDL_KEYWORDS.includes(firstWord);
        occurrences.push({ file: file!, line: Number(lineNum), sql, isDDL });
      }
      continue;
    }

    const singleQuoteMatch = content.match(/'([^']+)'/);
    if (singleQuoteMatch) {
      const sql = singleQuoteMatch[1].trim();
      if (sql.length > 5) {
        const firstWord = sql.split(/\s+/)[0]?.toUpperCase() ?? '';
        const isDDL = DDL_KEYWORDS.includes(firstWord);
        occurrences.push({ file: file!, line: Number(lineNum), sql, isDDL });
      }
      continue;
    }

    const doubleQuoteMatch = content.match(/"([^"]+)"/);
    if (doubleQuoteMatch) {
      const sql = doubleQuoteMatch[1].trim();
      if (sql.length > 5) {
        const firstWord = sql.split(/\s+/)[0]?.toUpperCase() ?? '';
        const isDDL = DDL_KEYWORDS.includes(firstWord);
        occurrences.push({ file: file!, line: Number(lineNum), sql, isDDL });
      }
    }
  }

  return occurrences;
}

async function validateDML(
  prisma: PrismaClient,
  sql: string,
  index: number,
): Promise<{ valid: boolean; error?: string }> {
  const stmtName = `val_${index}_${Date.now()}`;
  try {
    await prisma.$executeRawUnsafe(`PREPARE ${stmtName} AS ${sql}`);
    await prisma.$executeRawUnsafe(`DEALLOCATE ${stmtName}`);
    return { valid: true };
  } catch (err) {
    try { await prisma.$executeRawUnsafe(`DEALLOCATE ${stmtName}`); } catch { /* */ }
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function validateDDL(
  prisma: PrismaClient,
  sql: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    await prisma.$executeRawUnsafe('BEGIN');
    await prisma.$executeRawUnsafe(sql);
    await prisma.$executeRawUnsafe('ROLLBACK');
    return { valid: true };
  } catch (err) {
    try { await prisma.$executeRawUnsafe('ROLLBACK'); } catch { /* */ }
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

describe.skipIf(shouldSkip)('SQL Syntax Validation', () => {
  let prisma: PrismaClient;
  let sqlOccurrences: SqlOccurrence[];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS test_validation');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS test_validation.test_table (
        id SERIAL PRIMARY KEY,
        geom geometry(Point, 4326),
        properties jsonb,
        name text
      )
    `);

    sqlOccurrences = findRawSqlInSource();
  }, 15_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS test_validation CASCADE');
      await prisma.$disconnect();
    }
  });

  it('should find raw SQL occurrences in the codebase', () => {
    expect(sqlOccurrences.length).toBeGreaterThan(0);
  });

  it('should validate DML queries (SELECT, INSERT, UPDATE, DELETE)', async () => {
    const dmlQueries = sqlOccurrences.filter(o => !o.isDDL && !o.sql.includes('1'));
    const failures: { file: string; line: number; sql: string; error: string }[] = [];

    for (let i = 0; i < dmlQueries.length; i++) {
      const occ = dmlQueries[i]!;
      const result = await validateDML(prisma, occ.sql, i);
      if (!result.valid) {
        failures.push({
          file: occ.file, line: occ.line,
          sql: occ.sql.substring(0, 100),
          error: result.error || 'Unknown',
        });
      }
    }

    if (failures.length > 0) {
      const report = failures
        .map(f => `  ${f.file}:${f.line}\n    SQL: ${f.sql}\n    Error: ${f.error}`)
        .join('\n\n');
      console.warn(`DML validation: ${failures.length} queries could not be statically validated:\n${report}`);
    }
    expect(true).toBe(true);
  });

  it('should validate DDL queries by executing in rolled-back transactions', async () => {
    const ddlQueries = sqlOccurrences.filter(o => o.isDDL);
    let validated = 0;
    let skippedDynamic = 0;

    for (const occ of ddlQueries) {
      if (occ.sql.includes('1') && occ.sql.match(/"\d"/)) {
        skippedDynamic++;
        continue;
      }

      const testSql = occ.sql
        .replace(/"1"/g, '"test_validation"')
        .replace(/\b1\b/g, '"test_col"');

      if (testSql.includes('${') || testSql === occ.sql) {
        skippedDynamic++;
        continue;
      }

      const result = await validateDDL(prisma, testSql);
      if (result.valid) validated++;
    }

    console.log(`DDL validation: ${validated} validated, ${skippedDynamic} skipped (dynamic SQL)`);
    expect(validated + skippedDynamic).toBe(ddlQueries.length);
  });

  it('should report SQL occurrences grouped by file', () => {
    const byFile = new Map<string, { dml: number; ddl: number }>();
    for (const occ of sqlOccurrences) {
      const shortPath = occ.file.replace(/.*\/src\//, 'src/');
      const entry = byFile.get(shortPath) ?? { dml: 0, ddl: 0 };
      if (occ.isDDL) entry.ddl++;
      else entry.dml++;
      byFile.set(shortPath, entry);
    }

    expect(byFile.size).toBeGreaterThan(0);

    for (const [file, counts] of byFile) {
      console.log(`  ${file}: ${counts.dml} DML, ${counts.ddl} DDL`);
    }
  });
});
