import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMapCompositionsUseCase } from '../../../../../src/application/use-cases/maps/get-map-compositions.use-case.js';

describe('GetMapCompositionsUseCase', () => {
  let useCase: GetMapCompositionsUseCase;
  let repository: { findByInstanceId: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findByInstanceId: vi.fn() };
    useCase = new GetMapCompositionsUseCase(repository as any);
  });

  it('should return compositions for an instance', async () => {
    const records = [{ id: '1' }, { id: '2' }];
    repository.findByInstanceId.mockResolvedValue(records);

    const result = await useCase.execute('instance-1');
    expect(result).toEqual(records);
    expect(repository.findByInstanceId).toHaveBeenCalledWith('instance-1');
  });

  it('should return empty array when none exist', async () => {
    repository.findByInstanceId.mockResolvedValue([]);
    const result = await useCase.execute('instance-1');
    expect(result).toEqual([]);
  });
});
