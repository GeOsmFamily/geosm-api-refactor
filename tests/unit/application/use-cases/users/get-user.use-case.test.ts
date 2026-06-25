import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetUserUseCase } from '../../../../../src/application/use-cases/users/get-user.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';
import { Role } from '../../../../../src/domain/enums.js';

describe('GetUserUseCase', () => {
  let useCase: GetUserUseCase;
  let userRepository: IUserRepository;
  const now = new Date();
  const mockUser = new User({
    id: 'u1', email: 'test@example.com', passwordHash: 'hash',
    firstName: 'John', lastName: 'Doe', avatar: null, role: Role.VIEWER,
    isActive: true, emailVerifiedAt: now, lastLoginAt: null, createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    userRepository = { findById: vi.fn(), findByEmail: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), existsByEmail: vi.fn() };
    useCase = new GetUserUseCase(userRepository);
  });

  it('should return user when found', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    const result = await useCase.execute('u1');
    expect(result.id).toBe('u1');
    expect(result.email).toBe('test@example.com');
  });

  it('should throw NotFoundError when user not found', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('u1')).rejects.toThrow(NotFoundError);
  });
});
