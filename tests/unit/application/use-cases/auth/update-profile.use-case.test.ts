import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateProfileUseCase } from '../../../../../src/application/use-cases/auth/update-profile.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('UpdateProfileUseCase', () => {
  let useCase: UpdateProfileUseCase;
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
    useCase = new UpdateProfileUseCase(userRepository);
  });

  it('should update and return the profile', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(userRepository.update).mockResolvedValue(
      new User({ ...mockUser, firstName: 'Johnny' }),
    );

    const result = await useCase.execute('user-id', { firstName: 'Johnny', lastName: 'Doe', avatar: null });

    expect(userRepository.update).toHaveBeenCalledWith('user-id', {
      firstName: 'Johnny',
      lastName: 'Doe',
      avatar: null,
    });
    expect(result.firstName).toBe('Johnny');
  });

  it('should throw NotFoundError if the user does not exist', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('missing-id', { firstName: 'Johnny', lastName: 'Doe', avatar: null }),
    ).rejects.toThrow(NotFoundError);
    expect(userRepository.update).not.toHaveBeenCalled();
  });
});
