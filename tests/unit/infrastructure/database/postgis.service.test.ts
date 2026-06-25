import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostGISService } from '../../../../src/infrastructure/database/postgis.service.js';
import type { GeoJSONFeature } from '../../../../src/infrastructure/database/postgis.service.js';

vi.mock('../../../../src/infrastructure/observability/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('PostGISService', () => {
  let service: PostGISService;
  let prisma: {
    $executeRawUnsafe: ReturnType<typeof vi.fn>;
    $queryRawUnsafe: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ $executeRawUnsafe: vi.fn().mockResolvedValue(undefined) }),
      ),
    };
    service = new PostGISService(prisma as any);
  });

  describe('createSchema', () => {
    it('should create a schema with sanitized name', async () => {
      await service.createSchema('my_schema');
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE SCHEMA IF NOT EXISTS "my_schema"'),
      );
    });

    it('should sanitize identifier - strip non-alphanumeric except _ and -', async () => {
      await service.createSchema('test; DROP TABLE');
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('"testDROPTABLE"'),
      );
    });
  });

  describe('createSpatialTable', () => {
    it('should create a spatial table and index', async () => {
      await service.createSpatialTable('myschema', 'mytable', 'POINT', 4326);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "myschema"."mytable"'),
      );
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS'),
      );
    });
  });

  describe('insertFeatures', () => {
    it('should insert features and return count', async () => {
      const features: GeoJSONFeature[] = [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [11, 3] }, properties: { name: 'A' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [12, 4] }, properties: { name: 'B' } },
      ];

      const result = await service.insertFeatures('schema', 'table', features);
      expect(result).toBe(2);
    });

    it('should insert features with specific columns', async () => {
      const features: GeoJSONFeature[] = [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [11, 3] }, properties: { name: 'A', pop: 100 } },
      ];

      const result = await service.insertFeatures('schema', 'table', features, ['name', 'pop']);
      expect(result).toBe(1);
    });
  });

  describe('queryFeatures', () => {
    it('should return a GeoJSON FeatureCollection', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        { id: 1, geometry: { type: 'Point', coordinates: [11, 3] }, properties: { name: 'A' } },
      ]);

      const result = await service.queryFeatures({ schema: 'myschema', table: 'mytable' });
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('Feature');
    });

    it('should add bbox filter when provided', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      await service.queryFeatures({
        schema: 'myschema',
        table: 'mytable',
        bbox: [10, 2, 12, 4],
      });

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('ST_MakeEnvelope'),
      );
    });

    it('should add limit and offset', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      await service.queryFeatures({
        schema: 'myschema',
        table: 'mytable',
        limit: 10,
        offset: 5,
      });

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 10'),
      );
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET 5'),
      );
    });
  });

  describe('getLayerStats', () => {
    it('should return layer statistics', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        { feature_count: 42, total_area: 123.45, total_length: null, xmin: 10, ymin: 2, xmax: 12, ymax: 4 },
      ]);

      const stats = await service.getLayerStats('myschema', 'mytable');
      expect(stats.featureCount).toBe(42);
      expect(stats.totalArea).toBe(123.45);
      expect(stats.totalLength).toBeNull();
      expect(stats.bbox).toEqual([10, 2, 12, 4]);
    });

    it('should return null bbox when no features', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        { feature_count: 0, total_area: null, total_length: null, xmin: null, ymin: null, xmax: null, ymax: null },
      ]);

      const stats = await service.getLayerStats('myschema', 'mytable');
      expect(stats.featureCount).toBe(0);
      expect(stats.bbox).toBeNull();
    });
  });

  describe('getAltitude', () => {
    it('should return altitude value', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ altitude: 750 }]);

      const result = await service.getAltitude(11.5, 3.8);
      expect(result).toBe(750);
    });

    it('should return null when no raster data found', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getAltitude(11.5, 3.8);
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      prisma.$queryRawUnsafe.mockRejectedValue(new Error('raster error'));

      const result = await service.getAltitude(11.5, 3.8);
      expect(result).toBeNull();
    });
  });
});
