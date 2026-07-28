import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListPendingPersonalLayerPublicationsUseCase } from '../../../../../src/application/use-cases/personal-layers/list-pending-personal-layer-publications.use-case.js';

describe('ListPendingPersonalLayerPublicationsUseCase', () => {
  let useCase: ListPendingPersonalLayerPublicationsUseCase;
  let repository: { listPendingForInstance: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { listPendingForInstance: vi.fn() };
    useCase = new ListPendingPersonalLayerPublicationsUseCase(repository as any);
  });

  it('should return pending publications for the given instance', async () => {
    const layers = [{ id: 'pl-1', status: 'PENDING_PUBLICATION' }];
    repository.listPendingForInstance.mockResolvedValue(layers);

    const result = await useCase.execute('instance-1');

    expect(repository.listPendingForInstance).toHaveBeenCalledWith('instance-1');
    expect(result).toBe(layers);
  });

  it('should return an empty array when nothing is pending', async () => {
    repository.listPendingForInstance.mockResolvedValue([]);

    const result = await useCase.execute('instance-2');

    expect(result).toEqual([]);
  });
});
