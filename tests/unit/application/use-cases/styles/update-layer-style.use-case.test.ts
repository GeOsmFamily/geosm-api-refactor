import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateLayerStyleUseCase } from '../../../../../src/application/use-cases/styles/update-layer-style.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { ILayerStyleRepository } from '../../../../../src/domain/repositories/layer-style.repository.js';
import { LayerStyle } from '../../../../../src/domain/entities/layer-style.entity.js';

describe('UpdateLayerStyleUseCase', () => {
  let useCase: UpdateLayerStyleUseCase;
  let layerStyleRepository: ILayerStyleRepository;
  const now = new Date();
  const mockStyle = new LayerStyle({ id: 's1', name: 'Default', sldBody: null, mapboxStyle: null, isDefault: true, layerId: 'l1', createdAt: now, updatedAt: now });

  beforeEach(() => {
    layerStyleRepository = { findByLayerId: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    useCase = new UpdateLayerStyleUseCase(layerStyleRepository);
  });

  it('should update style when found', async () => {
    vi.mocked(layerStyleRepository.findById).mockResolvedValue(mockStyle);
    const updated = new LayerStyle({ ...mockStyle, name: 'Updated' });
    vi.mocked(layerStyleRepository.update).mockResolvedValue(updated);
    const result = await useCase.execute('s1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('should throw NotFoundError when not found', async () => {
    vi.mocked(layerStyleRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('s1', { name: 'X' })).rejects.toThrow(NotFoundError);
  });
});
