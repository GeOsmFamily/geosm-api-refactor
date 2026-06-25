import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListInstancesUseCase } from '../../../../../src/application/use-cases/instances/list-instances.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';

describe('ListInstancesUseCase', () => {
  let useCase: ListInstancesUseCase;
  let instanceRepository: IInstanceRepository;

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(),
      removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new ListInstancesUseCase(instanceRepository);
  });

  it('should return paginated instances', async () => {
    vi.mocked(instanceRepository.findAll).mockResolvedValue({ data: [], total: 0 });
    const result = await useCase.execute({ page: 1, limit: 10 });
    expect(result).toEqual({ data: [], total: 0 });
    expect(instanceRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 10, search: undefined, isActive: undefined });
  });

  it('should use default pagination', async () => {
    vi.mocked(instanceRepository.findAll).mockResolvedValue({ data: [], total: 0 });
    await useCase.execute({});
    expect(instanceRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 20, search: undefined, isActive: undefined });
  });
});
