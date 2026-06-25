import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateLayerUseCase } from '../../../../../src/application/use-cases/layers/update-layer.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';

describe('UpdateLayerUseCase', () => {
  let useCase: UpdateLayerUseCase;
  let layerRepository: ILayerRepository;
  const now = new Date();
  const mockLayer = new Layer({
    id: 'l1', name: 'Layer', slug: 'layer', description: null,
    geometryType: GeometryType.POINT, sourceType: SourceType.WMS,
    sourceUrl: null, sourceLayer: null, tableName: null, schemaName: null,
    minZoom: 0, maxZoom: 18, isVisible: true, isQueryable: true,
    opacity: 1, order: 0, metadata: null, subGroupId: 'sg1',
    instanceId: 'i1', qgisProjectId: null, createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    layerRepository = { findById: vi.fn(), findBySlug: vi.fn(), findBySubGroup: vi.fn(), findByInstance: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    useCase = new UpdateLayerUseCase(layerRepository);
  });

  it('should update layer when found', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(mockLayer);
    const updated = new Layer({ ...mockLayer, name: 'Updated' });
    vi.mocked(layerRepository.update).mockResolvedValue(updated);
    const result = await useCase.execute('l1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('should throw NotFoundError when not found', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('l1', { name: 'X' })).rejects.toThrow(NotFoundError);
  });
});
