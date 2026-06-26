import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeInstanceUserRoleUseCase } from '../../../../../src/application/use-cases/instances/change-instance-user-role.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { Role } from '../../../../../src/domain/enums.js';

describe('ChangeInstanceUserRoleUseCase', () => {
  let useCase: ChangeInstanceUserRoleUseCase;
  let instanceRepository: IInstanceRepository;
  const now = new Date();

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new ChangeInstanceUserRoleUseCase(instanceRepository);
  });

  it('should change user role successfully', async () => {
    const existing = { id: 'iu-1', userId: 'u1', instanceId: 'inst-1', role: Role.VIEWER, createdAt: now, updatedAt: now };
    const updated = { ...existing, role: Role.EDITOR };
    vi.mocked(instanceRepository.findInstanceUser).mockResolvedValue(existing);
    vi.mocked(instanceRepository.changeInstanceUserRole).mockResolvedValue(updated);

    const result = await useCase.execute('inst-1', 'u1', { role: Role.EDITOR });
    expect(result.role).toBe(Role.EDITOR);
  });

  it('should throw NotFoundError if instance user not found', async () => {
    vi.mocked(instanceRepository.findInstanceUser).mockResolvedValue(null);
    await expect(useCase.execute('inst-1', 'u1', { role: Role.EDITOR })).rejects.toThrow(NotFoundError);
  });
});
