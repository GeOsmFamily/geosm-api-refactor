import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoveInstanceUserUseCase } from '../../../../../src/application/use-cases/instances/remove-instance-user.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { Role } from '../../../../../src/domain/enums.js';

describe('RemoveInstanceUserUseCase', () => {
  let useCase: RemoveInstanceUserUseCase;
  let instanceRepository: IInstanceRepository;
  const now = new Date();

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new RemoveInstanceUserUseCase(instanceRepository);
  });

  it('should remove instance user successfully', async () => {
    const existing = { id: 'iu-1', userId: 'u1', instanceId: 'inst-1', role: Role.VIEWER, createdAt: now, updatedAt: now };
    vi.mocked(instanceRepository.findInstanceUser).mockResolvedValue(existing);
    vi.mocked(instanceRepository.removeInstanceUser).mockResolvedValue(undefined);

    await useCase.execute('inst-1', 'u1');
    expect(instanceRepository.removeInstanceUser).toHaveBeenCalledWith('inst-1', 'u1');
  });

  it('should throw NotFoundError if instance user not found', async () => {
    vi.mocked(instanceRepository.findInstanceUser).mockResolvedValue(null);
    await expect(useCase.execute('inst-1', 'u1')).rejects.toThrow(NotFoundError);
  });
});
