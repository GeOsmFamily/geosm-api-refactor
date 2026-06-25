import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangePasswordUseCase } from '../../../../../src/application/use-cases/auth/change-password.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { UnauthorizedError } from '../../../../../src/domain/errors/unauthorized.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IPasswordService } from '../../../../../src/application/services/password.service.js';
import type { IRefreshTokenRepository } from '../../../../../src/domain/repositories/refresh-token.repository.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';
import { Role } from '../../../../../src/domain/enums.js';

describe('ChangePasswordUseCase', () => {
  let useCase: ChangePasswordUseCase;
  let userRepository: IUserRepository;
  let passwordService: IPasswordService;
  let refreshTokenRepository: IRefreshTokenRepository;
  const now = new Date();
  const mockUser = new User({
    id: 'u1', email: 'test@example.com', passwordHash: 'old-hash',
    firstName: 'John', lastName: 'Doe', avatar: null, role: Role.VIEWER,
    isActive: true, emailVerifiedAt: now, lastLoginAt: null, createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    userRepository = { findById: vi.fn(), findByEmail: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), existsByEmail: vi.fn() };
    passwordService = { hash: vi.fn(), verify: vi.fn() };
    refreshTokenRepository = { findByToken: vi.fn(), create: vi.fn(), revokeByToken: vi.fn(), revokeAllByFamily: vi.fn(), revokeAllByUserId: vi.fn(), deleteExpired: vi.fn() };
    useCase = new ChangePasswordUseCase(userRepository, passwordService, refreshTokenRepository);
  });

  it('should change password successfully', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(passwordService.verify).mockResolvedValue(true);
    vi.mocked(passwordService.hash).mockResolvedValue('new-hash');
    vi.mocked(userRepository.update).mockResolvedValue(mockUser);

    await useCase.execute('u1', { currentPassword: 'old', newPassword: 'new' });

    expect(userRepository.update).toHaveBeenCalledWith('u1', { passwordHash: 'new-hash' });
    expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('u1');
  });

  it('should throw NotFoundError when user not found', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('u1', { currentPassword: 'old', newPassword: 'new' })).rejects.toThrow(NotFoundError);
  });

  it('should throw UnauthorizedError when current password is wrong', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(passwordService.verify).mockResolvedValue(false);
    await expect(useCase.execute('u1', { currentPassword: 'wrong', newPassword: 'new' })).rejects.toThrow(UnauthorizedError);
  });
});
