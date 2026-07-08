import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeUserRoleUseCase } from '../../../../../src/application/use-cases/users/change-user-role.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('ChangeUserRoleUseCase', () => {
  let useCase: ChangeUserRoleUseCase;
  let userRepository: IUserRepository;
  const now = new Date();

  const mockUser = new User({
    id: 'user-id',
    email: 'test@example.com',
    passwordHash: 'hashed',
    firstName: 'John',
    lastName: 'Doe',
    avatar: null,
    role: Role.VIEWER,
    isActive: true,
    emailVerifiedAt: now,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  });

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      existsByEmail: vi.fn(),
    };
    useCase = new ChangeUserRoleUseCase(userRepository);
  });

  it('should elevate the user role', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(userRepository.update).mockResolvedValue(new User({ ...mockUser, role: Role.ADMIN_INSTANCE }));

    const result = await useCase.execute('user-id', { role: Role.ADMIN_INSTANCE });

    expect(userRepository.update).toHaveBeenCalledWith('user-id', { role: Role.ADMIN_INSTANCE });
    expect(result.role).toBe(Role.ADMIN_INSTANCE);
  });

  it('should throw NotFoundError if the user does not exist', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('missing-id', { role: Role.ADMIN_INSTANCE })).rejects.toThrow(NotFoundError);
    expect(userRepository.update).not.toHaveBeenCalled();
  });
});
