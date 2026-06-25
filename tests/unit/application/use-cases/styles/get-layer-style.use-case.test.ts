import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetLayerStyleUseCase } from '../../../../../src/application/use-cases/styles/get-layer-style.use-case.js';
import type { ILayerStyleRepository } from '../../../../../src/domain/repositories/layer-style.repository.js';
import { LayerStyle } from '../../../../../src/domain/entities/layer-style.entity.js';

describe('GetLayerStyleUseCase', () => {
  let useCase: GetLayerStyleUseCase;
  let layerStyleRepository: ILayerStyleRepository;
  const now = new Date();

  beforeEach(() => {
    layerStyleRepository = { findByLayerId: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    useCase = new GetLayerStyleUseCase(layerStyleRepository);
  });

  it('should return styles for layer', async () => {
    const mockStyle = new LayerStyle({ id: 's1', name: 'Default', sldBody: null, mapboxStyle: null, isDefault: true, layerId: 'l1', createdAt: now, updatedAt: now });
    vi.mocked(layerStyleRepository.findByLayerId).mockResolvedValue([mockStyle]);
    const result = await useCase.execute('l1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Default');
  });

  it('should return empty array when no styles', async () => {
    vi.mocked(layerStyleRepository.findByLayerId).mockResolvedValue([]);
    const result = await useCase.execute('l1');
    expect(result).toEqual([]);
  });
});
