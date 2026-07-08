import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserUseCase } from '../../../../../src/application/use-cases/users/create-user.use-case.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IPasswordService } from '../../../../../src/application/services/password.service.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userRepository: IUserRepository;
  let passwordService: IPasswordService;
  const now = new Date();

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      existsByEmail: vi.fn(),
    };
    passwordService = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
      verify: vi.fn(),
    };
    useCase = new CreateUserUseCase(userRepository, passwordService);
  });

  it('should create a user with the default VIEWER role when none is specified', async () => {
    vi.mocked(userRepository.existsByEmail).mockResolvedValue(false);
    vi.mocked(userRepository.create).mockResolvedValue(
      new User({
        id: 'new-id', email: 'admin-created@example.com', passwordHash: 'hashed-password',
        firstName: 'Jane', lastName: 'Doe', avatar: null, role: Role.VIEWER, isActive: true,
        emailVerifiedAt: now, lastLoginAt: null, createdAt: now, updatedAt: now,
      }),
    );

    const result = await useCase.execute({
      email: 'admin-created@example.com', password: 'password123', firstName: 'Jane', lastName: 'Doe',
    });

    expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({ role: Role.VIEWER }));
    expect(result.role).toBe(Role.VIEWER);
  });

  it('should create a user with an explicitly requested role', async () => {
    vi.mocked(userRepository.existsByEmail).mockResolvedValue(false);
    vi.mocked(userRepository.create).mockResolvedValue(
      new User({
        id: 'new-id', email: 'editor@example.com', passwordHash: 'hashed-password',
        firstName: 'Jane', lastName: 'Doe', avatar: null, role: Role.EDITOR, isActive: true,
        emailVerifiedAt: now, lastLoginAt: null, createdAt: now, updatedAt: now,
      }),
    );

    await useCase.execute({
      email: 'editor@example.com', password: 'password123', firstName: 'Jane', lastName: 'Doe', role: Role.EDITOR,
    });

    expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({ role: Role.EDITOR }));
  });

  it('should throw ConflictError if the email is already in use', async () => {
    vi.mocked(userRepository.existsByEmail).mockResolvedValue(true);

    await expect(
      useCase.execute({ email: 'existing@example.com', password: 'password123', firstName: 'Jane', lastName: 'Doe' }),
    ).rejects.toThrow(ConflictError);
    expect(userRepository.create).not.toHaveBeenCalled();
  });
});
