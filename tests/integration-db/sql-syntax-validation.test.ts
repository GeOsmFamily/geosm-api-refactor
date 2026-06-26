import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { resolve } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const shouldSkip = !DATABASE_URL;

interface SqlOccurrence {
  file: string;
  line: number;
  sql: string;
}

/**
 * Extracts raw SQL strings from $queryRawUnsafe and $executeRawUnsafe calls.
 * Uses grep + simple heuristics to pull out SQL template literals.
 */
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

    // Try to extract SQL from inline template literals or string literals
    // Match backtick strings: `SELECT ...`
    const backtickMatch = content.match(/`([^`]+)`/);
    if (backtickMatch) {
      const sql = backtickMatch[1]
        .replace(/\$\{[^}]+\}/g, '1') // Replace template expressions with placeholder
        .trim();
      if (sql.length > 5) {
        occurrences.push({ file: file!, line: Number(lineNum), sql });
      }
      continue;
    }

    // Match single-quoted strings: 'SELECT ...'
    const singleQuoteMatch = content.match(/'([^']+)'/);
    if (singleQuoteMatch) {
      const sql = singleQuoteMatch[1].trim();
      if (sql.length > 5) {
        occurrences.push({ file: file!, line: Number(lineNum), sql });
      }
      continue;
    }

    // Match double-quoted strings: "SELECT ..."
    const doubleQuoteMatch = content.match(/"([^"]+)"/);
    if (doubleQuoteMatch) {
      const sql = doubleQuoteMatch[1].trim();
      if (sql.length > 5) {
        occurrences.push({ file: file!, line: Number(lineNum), sql });
      }
    }
  }

  return occurrences;
}

/**
 * Validate SQL syntax by using PREPARE on PostgreSQL.
 * We wrap the SQL in a PREPARE statement and then DEALLOCATE immediately.
 * This validates syntax without executing.
 */
async function validateSqlSyntax(
  prisma: PrismaClient,
  sql: string,
  index: number,
): Promise<{ valid: boolean; error?: string }> {
  const stmtName = `validation_stmt_${index}_${Date.now()}`;

  // Normalize SQL: replace interpolated values with parameter placeholders
  // Replace quoted identifiers that might have template vars
  let normalizedSql = sql
    .replace(/\$\{[^}]+\}/g, 'placeholder_value')
    .replace(/\$\d+/g, "'placeholder'"); // Replace Prisma-style $1, $2

  // Skip if it's clearly a dynamic/constructed SQL that can't be statically validated
  if (normalizedSql.includes('placeholder_value')) {
    return { valid: true }; // Can't validate dynamic SQL statically
  }

  try {
    await prisma.$executeRawUnsafe(`PREPARE ${stmtName} AS ${normalizedSql}`);
    await prisma.$executeRawUnsafe(`DEALLOCATE ${stmtName}`);
    return { valid: true };
  } catch (err) {
    // Try to deallocate in case it was partially created
    try {
      await prisma.$executeRawUnsafe(`DEALLOCATE ${stmtName}`);
    } catch {
      // ignore
    }
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

describe.skipIf(shouldSkip)('SQL Syntax Validation', () => {
  let prisma: PrismaClient;
  let sqlOccurrences: SqlOccurrence[];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    sqlOccurrences = findRawSqlInSource();
  }, 15_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('should find raw SQL occurrences in the codebase', () => {
    expect(sqlOccurrences.length).toBeGreaterThan(0);
  });

  it('should have valid SQL syntax for all extractable static queries', async () => {
    const failures: { file: string; line: number; sql: string; error: string }[] = [];

    for (let i = 0; i < sqlOccurrences.length; i++) {
      const occ = sqlOccurrences[i]!;
      const result = await validateSqlSyntax(prisma, occ.sql, i);
      if (!result.valid) {
        failures.push({
          file: occ.file,
          line: occ.line,
          sql: occ.sql.substring(0, 100),
          error: result.error || 'Unknown error',
        });
      }
    }

    if (failures.length > 0) {
      const report = failures
        .map((f) => `  ${f.file}:${f.line}\n    SQL: ${f.sql}\n    Error: ${f.error}`)
        .join('\n\n');
      expect.fail(`SQL syntax validation failed for ${failures.length} queries:\n\n${report}`);
    }
  });

  it('should report SQL occurrences grouped by file', () => {
    const byFile = new Map<string, number>();
    for (const occ of sqlOccurrences) {
      byFile.set(occ.file, (byFile.get(occ.file) || 0) + 1);
    }

    // Just verify we can group them -- this is informational
    expect(byFile.size).toBeGreaterThan(0);

    // Log summary for debugging
    for (const [file, count] of byFile) {
      // Strip the absolute path prefix for readability
      const shortPath = file.replace(/.*\/src\//, 'src/');
      console.log(`  ${shortPath}: ${count} raw SQL call(s)`);
    }
  });
});
