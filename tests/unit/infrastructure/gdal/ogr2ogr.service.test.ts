import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecAsync } = vi.hoisted(() => ({ mockExecAsync: vi.fn() }));
vi.mock('child_process', () => ({ exec: vi.fn() }));
vi.mock('util', () => ({ promisify: vi.fn(() => mockExecAsync) }));
vi.mock('fs', () => ({ existsSync: vi.fn(() => true) }));
vi.mock('fs/promises', () => ({ mkdir: vi.fn(), unlink: vi.fn() }));
vi.mock('../../../../src/config/env.config.js', () => ({
  config: { DATABASE_URL: 'postgresql://user:pass@localhost:5432/geosm' },
}));
vi.mock('../../../../src/infrastructure/observability/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { Ogr2OgrService } from '../../../../src/infrastructure/gdal/ogr2ogr.service.js';

describe('Ogr2OgrService', () => {
  let service: Ogr2OgrService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new Ogr2OgrService();
  });

  describe('importFile', () => {
    it('should run ogr2ogr import command and return result', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'import done', stderr: '' })
        .mockResolvedValueOnce({
          stdout: 'Feature Count: 42\nGeometry: Point\nEPSG:4326\nname: String',
          stderr: '',
        });

      const result = await service.importFile('/data/test.geojson', 'myschema', 'mytable');
      expect(result.schemaName).toBe('myschema');
      expect(result.tableName).toBe('mytable');
      expect(result.featureCount).toBe(42);
      expect(result.srid).toBe(4326);
    });

    it('should handle zip files with /vsizip/ prefix', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Feature Count: 10\nGeometry: Polygon', stderr: '' });

      await service.importFile('/data/test.zip', 'schema', 'table');
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('/vsizip/'),
        expect.any(Object),
      );
    });

    it('should throw on exec failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('ogr2ogr not found'));

      await expect(service.importFile('/data/test.geojson', 'schema', 'table'))
        .rejects.toThrow('ogr2ogr import failed');
    });
  });

  describe('exportToFile', () => {
    it('should run ogr2ogr export command and return output path', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await service.exportToFile({
        schema: 'myschema',
        table: 'mytable',
        format: 'GeoJSON',
        outputPath: '/tmp/output.geojson',
      });

      expect(result).toBe('/tmp/output.geojson');
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('ogr2ogr'),
        expect.any(Object),
      );
    });

    it('should include bbox filter when provided', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await service.exportToFile({
        schema: 'myschema',
        table: 'mytable',
        format: 'GPKG',
        outputPath: '/tmp/output.gpkg',
        bbox: [10, 2, 12, 4],
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('ST_MakeEnvelope'),
        expect.any(Object),
      );
    });

    it('should throw on exec failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('disk full'));

      await expect(
        service.exportToFile({
          schema: 'myschema',
          table: 'mytable',
          format: 'GeoJSON',
          outputPath: '/tmp/output.geojson',
        }),
      ).rejects.toThrow('ogr2ogr export failed');
    });
  });

  describe('getFileInfo', () => {
    it('should parse ogrinfo output', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Feature Count: 100\nGeometry: MultiPolygon\nEPSG:32632\nname: String\npop: Integer',
        stderr: '',
      });

      const info = await service.getFileInfo('/data/test.gpkg');
      expect(info.featureCount).toBe(100);
      expect(info.geometryType).toBe('MultiPolygon');
      expect(info.srid).toBe(32632);
    });

    it('should return defaults on error', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('file not found'));

      const info = await service.getFileInfo('/data/missing.gpkg');
      expect(info.featureCount).toBe(0);
      expect(info.geometryType).toBe('Unknown');
    });
  });
});
