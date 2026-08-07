import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetLiveLayerDataUseCase } from '../../../../../src/application/use-cases/layers/get-live-layer-data.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';

describe('GetLiveLayerDataUseCase', () => {
  let layerRepository: { findById: ReturnType<typeof vi.fn> };
  let liveLayerService: { fetch: ReturnType<typeof vi.fn> };
  let useCase: GetLiveLayerDataUseCase;

  beforeEach(() => {
    layerRepository = { findById: vi.fn() };
    liveLayerService = { fetch: vi.fn(async () => ({ data: [] })) };
    useCase = new GetLiveLayerDataUseCase(layerRepository as any, liveLayerService as any);
  });

  it('throws NotFoundError when the layer does not exist', async () => {
    layerRepository.findById.mockResolvedValueOnce(null);
    await expect(useCase.execute('layer-1')).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when the layer has no live config', async () => {
    layerRepository.findById.mockResolvedValueOnce({ id: 'layer-1', metadata: null });
    await expect(useCase.execute('layer-1')).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when the live config is malformed', async () => {
    layerRepository.findById.mockResolvedValueOnce({
      id: 'layer-1',
      metadata: { live: { url: 'https://example.com' } },
    });
    await expect(useCase.execute('layer-1')).rejects.toThrow(ValidationError);
  });

  it('fetches live data through LiveLayerService when the config is valid', async () => {
    const liveConfig = { url: 'https://example.com', ttlSeconds: 60, refreshSeconds: 30 };
    layerRepository.findById.mockResolvedValueOnce({ id: 'layer-1', metadata: { live: liveConfig } });
    const result = await useCase.execute('layer-1');
    expect(result).toEqual({ data: [] });
    expect(liveLayerService.fetch).toHaveBeenCalledWith('layer-1', liveConfig);
  });
});
