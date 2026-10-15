import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LoginUseCase,
  LOCKOUT_SECONDS,
  MAX_FAILED_LOGINS,
} from '../../../../../src/application/use-cases/auth/login.use-case.js';
import { UnauthorizedError } from '../../../../../src/domain/errors/unauthorized.error.js';
import { TooManyRequestsError } from '../../../../../src/domain/errors/too-many-requests.error.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

const NOW = 1_800_000_000_000;

function user(over: Partial<ConstructorParameters<typeof User>[0]> = {}): User {
  return new User({
    id: 'u1', email: 'a@b.com', passwordHash: 'h', firstName: 'A', lastName: 'B', avatar: null,
    role: Role.VIEWER, isActive: true, emailVerifiedAt: null, lastLoginAt: null,
    createdAt: new Date(NOW), updatedAt: new Date(NOW), ...over,
  });
}

describe('LoginUseCase - temporisation (RG-A-11)', () => {
  let users: { findByEmail: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let password: { verify: ReturnType<typeof vi.fn> };
  let useCase: LoginUseCase;

  function build(): void {
    useCase = new LoginUseCase(
      users as never,
      { create: vi.fn().mockResolvedValue({}) } as never,
      password as never,
      { generateAccessToken: () => 'a', generateRefreshToken: () => 'r' } as never,
      () => NOW,
    );
  }

  beforeEach(() => {
    users = { findByEmail: vi.fn(), update: vi.fn().mockResolvedValue({}) };
    password = { verify: vi.fn().mockResolvedValue(false) };
    build();
  });

  it('incremente le compteur a chaque echec', async () => {
    users.findByEmail.mockResolvedValue(user({ failedLoginAttempts: 1 }));
    await expect(useCase.execute({ email: 'a@b.com', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(users.update).toHaveBeenCalledWith('u1', { failedLoginAttempts: 2, lockedUntil: null });
  });

  it('verrouille au cinquieme echec consecutif', async () => {
    users.findByEmail.mockResolvedValue(user({ failedLoginAttempts: MAX_FAILED_LOGINS - 1 }));
    await expect(useCase.execute({ email: 'a@b.com', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(users.update).toHaveBeenCalledWith('u1', {
      failedLoginAttempts: 0,
      lockedUntil: new Date(NOW + LOCKOUT_SECONDS * 1000),
    });
  });

  it('refuse meme le bon mot de passe pendant la temporisation', async () => {
    password.verify.mockResolvedValue(true);
    users.findByEmail.mockResolvedValue(user({ lockedUntil: new Date(NOW + 90_000) }));
    const err = await useCase.execute({ email: 'a@b.com', password: 'ok' }).catch((e) => e);
    expect(err).toBeInstanceOf(TooManyRequestsError);
    expect(err.statusCode).toBe(429);
    expect(err.details).toEqual({ retryAfterSeconds: 90 });
    expect(password.verify).not.toHaveBeenCalled();
  });

  it('repart de zero une fois la temporisation expiree', async () => {
    users.findByEmail.mockResolvedValue(
      user({ failedLoginAttempts: 0, lockedUntil: new Date(NOW - 1000) }),
    );
    await expect(useCase.execute({ email: 'a@b.com', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(users.update).toHaveBeenCalledWith('u1', { failedLoginAttempts: 1, lockedUntil: null });
  });

  it('une connexion reussie remet le compteur a zero', async () => {
    password.verify.mockResolvedValue(true);
    users.findByEmail.mockResolvedValue(user({ failedLoginAttempts: 3 }));
    await useCase.execute({ email: 'a@b.com', password: 'ok' });
    expect(users.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
    );
  });
});
