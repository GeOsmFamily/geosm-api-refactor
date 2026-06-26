import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Check if python3 is available
let python3Available = false;
try {
  execSync('python3 --version', { stdio: 'pipe' });
  python3Available = true;
} catch {
  // python3 not available
}

const scriptsDir = path.resolve(__dirname, '../../python_scripts');
const scripts = fs.existsSync(scriptsDir)
  ? fs.readdirSync(scriptsDir).filter((f) => f.endsWith('.py'))
  : [];

describe.skipIf(!python3Available)('QGIS Python Scripts', () => {
  it.each(scripts)('%s should parse without syntax errors', (script) => {
    const scriptPath = path.join(scriptsDir, script);
    // Use python3 -m py_compile to check syntax without executing imports
    const result = execSync(`python3 -m py_compile "${scriptPath}"`, {
      stdio: 'pipe',
      timeout: 10_000,
    });
    // py_compile exits 0 on success; if it throws, the test fails automatically
    expect(true).toBe(true);
  });
});
