import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogoutUseCase } from '../../../../../src/application/use-cases/auth/logout.use-case.js';
import type { IRefreshTokenRepository } from '../../../../../src/domain/repositories/refresh-token.repository.js';

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let refreshTokenRepository: IRefreshTokenRepository;

  beforeEach(() => {
    refreshTokenRepository = {
      findByToken: vi.fn(),
      create: vi.fn(),
      revokeByToken: vi.fn(),
      revokeAllByFamily: vi.fn(),
      revokeAllByUserId: vi.fn(),
      deleteExpired: vi.fn(),
    };
    useCase = new LogoutUseCase(refreshTokenRepository);
  });

  it('should revoke all tokens in the family when token exists', async () => {
    vi.mocked(refreshTokenRepository.findByToken).mockResolvedValue({ family: 'fam-1' } as any);
    await useCase.execute({ refreshToken: 'some-token' });
    expect(refreshTokenRepository.revokeAllByFamily).toHaveBeenCalledWith('fam-1');
  });

  it('should do nothing when token not found', async () => {
    vi.mocked(refreshTokenRepository.findByToken).mockResolvedValue(null);
    await useCase.execute({ refreshToken: 'invalid' });
    expect(refreshTokenRepository.revokeAllByFamily).not.toHaveBeenCalled();
  });
});
