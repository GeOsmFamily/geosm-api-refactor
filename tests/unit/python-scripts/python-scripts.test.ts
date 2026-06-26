import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

const PYTHON_SCRIPTS_DIR = resolve(__dirname, '../../../python_scripts');

let hasPython3 = false;
try {
  execSync('python3 --version', { stdio: 'pipe' });
  hasPython3 = true;
} catch {
  // python3 not available
}

const pyFiles = (() => {
  try {
    return readdirSync(PYTHON_SCRIPTS_DIR).filter((f) => f.endsWith('.py'));
  } catch {
    return [];
  }
})();

describe.skipIf(!hasPython3)('Python Scripts Validation', () => {
  beforeAll(() => {
    expect(pyFiles.length).toBeGreaterThan(0);
  });

  describe.each(pyFiles.map((f) => [f]))('%s', (filename) => {
    const filePath = join(PYTHON_SCRIPTS_DIR, filename as string);

    it('should exist and not be empty', () => {
      const stat = statSync(filePath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('should have valid Python syntax (ast.parse)', () => {
      const result = execSync(
        `python3 -c "import ast; ast.parse(open('${filePath}').read())"`,
        { stdio: 'pipe', timeout: 10_000 },
      );
      // If it didn't throw, syntax is valid
      expect(true).toBe(true);
    });

    it('should pass py_compile check', () => {
      execSync(
        `python3 -c "import py_compile; py_compile.compile('${filePath}', doraise=True)"`,
        { stdio: 'pipe', timeout: 10_000 },
      );
      expect(true).toBe(true);
    });

    it('should have a CLI interface (argparse or sys.argv)', () => {
      const content = readFileSync(filePath, 'utf-8');
      const hasCli = content.includes('argparse') || content.includes('ArgumentParser') || content.includes('sys.argv');
      expect(hasCli).toBe(true);
    });
  });
});
