import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetChoroplethStatsUseCase } from '../../../../../src/application/use-cases/geoportail/get-choropleth-stats.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';

describe('GetChoroplethStatsUseCase', () => {
  let layerRepository: { findById: ReturnType<typeof vi.fn> };
  let postGISService: {
    getTableColumns: ReturnType<typeof vi.fn>;
    getVectorZonalStats: ReturnType<typeof vi.fn>;
  };
  let findAdminBoundariesByLevelUseCase: { execute: ReturnType<typeof vi.fn> };
  let useCase: GetChoroplethStatsUseCase;

  const layer = { id: 'layer-1', instanceId: 'instance-1', schemaName: 'public', tableName: 'hospitals' };

  beforeEach(() => {
    layerRepository = { findById: vi.fn(async () => layer) };
    postGISService = {
      getTableColumns: vi.fn(async () => [{ name: 'population', type: 'integer' }]),
      getVectorZonalStats: vi.fn(async () => [{ zoneId: 1, sum: 42 }]),
    };
    findAdminBoundariesByLevelUseCase = {
      execute: vi.fn(async () => [
        { id: 1, name: 'Zone A', geojson: { type: 'Polygon' } },
        { id: 2, name: 'Zone B', geojson: { type: 'Polygon' } },
      ]),
    };
    useCase = new GetChoroplethStatsUseCase(
      layerRepository as any,
      postGISService as any,
      findAdminBoundariesByLevelUseCase as any,
    );
  });

  it('throws NotFoundError when the layer does not exist', async () => {
    layerRepository.findById.mockResolvedValueOnce(null);
    await expect(useCase.execute('layer-1', 'population', 8)).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when the layer has no queryable table', async () => {
    layerRepository.findById.mockResolvedValueOnce({ ...layer, schemaName: null, tableName: null });
    await expect(useCase.execute('layer-1', 'population', 8)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when the attribute does not exist on the table', async () => {
    await expect(useCase.execute('layer-1', 'unknown_attr', 8)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when the attribute is not numeric', async () => {
    postGISService.getTableColumns.mockResolvedValueOnce([{ name: 'name', type: 'text' }]);
    await expect(useCase.execute('layer-1', 'name', 8)).rejects.toThrow(ValidationError);
  });

  it('returns an empty array when no admin zones exist for this level', async () => {
    findAdminBoundariesByLevelUseCase.execute.mockResolvedValueOnce([]);
    const result = await useCase.execute('layer-1', 'population', 8);
    expect(result).toEqual([]);
  });

  it('aggregates values per zone, defaulting to null when a zone has no matching stat', async () => {
    const result = await useCase.execute('layer-1', 'population', 8);
    expect(result).toEqual([
      { zoneId: 1, zoneName: 'Zone A', geometry: { type: 'Polygon' }, value: 42 },
      { zoneId: 2, zoneName: 'Zone B', geometry: { type: 'Polygon' }, value: null },
    ]);
  });
});
