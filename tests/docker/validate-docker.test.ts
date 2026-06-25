import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');

function loadYaml(path: string): string {
  return readFileSync(path, 'utf-8');
}

describe('Docker configuration validation', () => {
  let composeContent: string;
  let dockerfileContent: string;

  beforeAll(() => {
    composeContent = loadYaml(resolve(ROOT, 'docker-compose.yml'));
    dockerfileContent = readFileSync(resolve(ROOT, 'Dockerfile'), 'utf-8');
  });

  describe('Dockerfile', () => {
    it('should exist', () => {
      expect(existsSync(resolve(ROOT, 'Dockerfile'))).toBe(true);
    });

    it('should have builder stage', () => {
      expect(dockerfileContent).toContain('AS builder');
    });

    it('should have production stage', () => {
      expect(dockerfileContent).toContain('AS production');
    });

    it('should use non-root user', () => {
      expect(dockerfileContent).toMatch(/^USER\s+\w+/m);
    });

    it('should have healthcheck', () => {
      expect(dockerfileContent).toContain('HEALTHCHECK');
    });

    it('should expose port 3000', () => {
      expect(dockerfileContent).toContain('EXPOSE 3000');
    });

    it('should install GDAL tools', () => {
      expect(dockerfileContent).toContain('gdal-bin');
    });

    it('should install osm2pgsql', () => {
      expect(dockerfileContent).toContain('osm2pgsql');
    });

    it('should install python3-qgis', () => {
      expect(dockerfileContent).toContain('python3-qgis');
    });

    it('should copy python_scripts', () => {
      expect(dockerfileContent).toContain('python_scripts');
    });
  });

  describe('docker-compose.yml', () => {
    const requiredServices = ['api', 'postgres', 'redis', 'minio', 'meilisearch', 'qgis-server'];

    it('should define all required services', () => {
      for (const svc of requiredServices) {
        expect(composeContent).toMatch(new RegExp(`^  ${svc}:`, 'm'));
      }
    });

    it('should have healthchecks for core services', () => {
      const healthcheckCount = (composeContent.match(/healthcheck:/g) || []).length;
      expect(healthcheckCount).toBeGreaterThanOrEqual(5);
    });

    it('should have resource limits for all services', () => {
      const limitsCount = (composeContent.match(/limits:/g) || []).length;
      expect(limitsCount).toBeGreaterThanOrEqual(6);
    });

    it('should have restart policies for all services', () => {
      const restartCount = (composeContent.match(/restart:/g) || []).length;
      expect(restartCount).toBeGreaterThanOrEqual(6);
    });

    it('should define all volumes', () => {
      const requiredVolumes = ['pgdata', 'redis-data', 'minio-data', 'meili-data', 'data-volume', 'qgis-projects', 'qgis-styles'];
      for (const vol of requiredVolumes) {
        expect(composeContent).toMatch(new RegExp(`^  ${vol}:`, 'm'));
      }
    });

    it('api should depend on all required services', () => {
      const apiSection = composeContent.split(/^  \w/m).find(s => s.includes('depends_on'));
      expect(apiSection).toBeDefined();
      for (const dep of ['postgres', 'redis', 'minio', 'meilisearch', 'qgis-server']) {
        expect(apiSection).toContain(dep);
      }
    });

    it('should have unique host ports', () => {
      const portMatches = composeContent.match(/"(\d+):\d+"/g) || [];
      const hostPorts = portMatches.map(p => p.match(/"(\d+):/)?.[1]);
      const unique = new Set(hostPorts);
      expect(unique.size).toBe(hostPorts.length);
    });

    it('should use env_file for api service', () => {
      expect(composeContent).toContain('env_file');
    });

    it('postgres should use postgis image', () => {
      expect(composeContent).toContain('postgis/postgis');
    });
  });

  describe('.dockerignore', () => {
    it('should exist', () => {
      expect(existsSync(resolve(ROOT, '.dockerignore'))).toBe(true);
    });

    it('should exclude node_modules', () => {
      const content = readFileSync(resolve(ROOT, '.dockerignore'), 'utf-8');
      expect(content).toContain('node_modules');
    });
  });

  describe('.env.example', () => {
    let envContent: string;

    beforeAll(() => {
      envContent = readFileSync(resolve(ROOT, '.env.example'), 'utf-8');
    });

    it('should exist', () => {
      expect(existsSync(resolve(ROOT, '.env.example'))).toBe(true);
    });

    const requiredVars = [
      'DATABASE_URL', 'REDIS_HOST', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET',
      'MINIO_ENDPOINT', 'MEILISEARCH_HOST', 'QGIS_SERVER_URL',
      'QGIS_PROJECTS_DIR', 'QGIS_STYLES_DIR', 'DATA_DIR',
      'POSTGRES_PASSWORD',
    ];

    it.each(requiredVars)('should define %s', (varName) => {
      expect(envContent).toMatch(new RegExp(`^${varName}=`, 'm'));
    });
  });
});
