import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryOsmUseCase } from '../../../../../src/application/use-cases/osm/query-osm.use-case.js';
import type { OsmQueryService } from '../../../../../src/infrastructure/database/osm-query.service.js';

describe('QueryOsmUseCase', () => {
  let useCase: QueryOsmUseCase;
  let osmQueryService: OsmQueryService;

  beforeEach(() => {
    osmQueryService = {
      queryFeatures: vi.fn().mockResolvedValue({ type: 'FeatureCollection', features: [] }),
    } as any;
    useCase = new QueryOsmUseCase(osmQueryService);
  });

  it('should return GeoJSON FeatureCollection', async () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [{ type: 'Feature' as const, geometry: { type: 'Point' }, properties: { name: 'School' } }],
    };
    vi.mocked(osmQueryService.queryFeatures).mockResolvedValue(fc);

    const result = await useCase.execute({
      conditions: [{ key: 'amenity', value: 'school' }],
    });

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
  });

  it('should throw when conditions are empty', async () => {
    await expect(useCase.execute({ conditions: [] })).rejects.toThrow(
      'At least one key/value condition is required',
    );
  });
});
