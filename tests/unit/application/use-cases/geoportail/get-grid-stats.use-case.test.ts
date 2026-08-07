import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetGridStatsUseCase } from '../../../../../src/application/use-cases/geoportail/get-grid-stats.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';

describe('GetGridStatsUseCase', () => {
  let layerRepository: { findById: ReturnType<typeof vi.fn> };
  let postGISService: { getGridStats: ReturnType<typeof vi.fn> };
  let useCase: GetGridStatsUseCase;

  const layer = { id: 'layer-1', schemaName: 'public', tableName: 'hospitals' };
  const extent: [number, number, number, number] = [9.6, 4.0, 9.8, 4.1];

  beforeEach(() => {
    layerRepository = { findById: vi.fn(async () => layer) };
    postGISService = {
      getGridStats: vi.fn(async () => [
        { geojson: JSON.stringify({ type: 'Polygon' }), value: 5 },
      ]),
    };
    useCase = new GetGridStatsUseCase(layerRepository as any, postGISService as any);
  });

  it('throws NotFoundError when the layer does not exist', async () => {
    layerRepository.findById.mockResolvedValueOnce(null);
    await expect(useCase.execute('layer-1', extent, 500, 'square')).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when the layer has no queryable table', async () => {
    layerRepository.findById.mockResolvedValueOnce({ ...layer, schemaName: null, tableName: null });
    await expect(useCase.execute('layer-1', extent, 500, 'square')).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when the cell size is below the minimum', async () => {
    await expect(useCase.execute('layer-1', extent, 5, 'square')).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when the cell size is above the maximum', async () => {
    await expect(useCase.execute('layer-1', extent, 200000, 'hexagon')).rejects.toThrow(ValidationError);
  });

  it('returns parsed grid cells for a valid request', async () => {
    const result = await useCase.execute('layer-1', extent, 500, 'hexagon');
    expect(result).toEqual([{ geometry: { type: 'Polygon' }, value: 5 }]);
    expect(postGISService.getGridStats).toHaveBeenCalledWith(
      'public',
      'hospitals',
      extent,
      500,
      'hexagon',
    );
  });
});
