import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToggleUserActiveUseCase } from '../../../../../src/application/use-cases/users/toggle-user-active.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('ToggleUserActiveUseCase', () => {
  let useCase: ToggleUserActiveUseCase;
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
    useCase = new ToggleUserActiveUseCase(userRepository);
  });

  it('should deactivate an active user (e.g. to immediately cut off a compromised account)', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(userRepository.update).mockResolvedValue(new User({ ...mockUser, isActive: false }));

    const result = await useCase.execute('user-id', { isActive: false });

    expect(userRepository.update).toHaveBeenCalledWith('user-id', { isActive: false });
    expect(result.isActive).toBe(false);
  });

  it('should reactivate a deactivated user', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(new User({ ...mockUser, isActive: false }));
    vi.mocked(userRepository.update).mockResolvedValue(mockUser);

    const result = await useCase.execute('user-id', { isActive: true });

    expect(result.isActive).toBe(true);
  });

  it('should throw NotFoundError if the user does not exist', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('missing-id', { isActive: false })).rejects.toThrow(NotFoundError);
    expect(userRepository.update).not.toHaveBeenCalled();
  });
});
