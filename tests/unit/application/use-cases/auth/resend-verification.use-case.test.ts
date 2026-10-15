import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendVerificationUseCase } from '../../../../../src/application/use-cases/auth/resend-verification.use-case.js';
import { TooManyRequestsError } from '../../../../../src/domain/errors/too-many-requests.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';
import { VERIFICATION_TOKEN_TTL_MS } from '../../../../../src/application/use-cases/auth/register.use-case.js';

const NOW = 1_800_000_000_000;

describe('ResendVerificationUseCase (RG-A-03, RG-A-04)', () => {
  let users: { findById: ReturnType<typeof vi.fn> };
  let email: { sendVerificationEmail: ReturnType<typeof vi.fn> };
  let tokens: {
    findLatestByUser: ReturnType<typeof vi.fn>;
    invalidateAllForUser: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let useCase: ResendVerificationUseCase;

  beforeEach(() => {
    users = { findById: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com', emailVerifiedAt: null }) };
    email = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };
    tokens = {
      findLatestByUser: vi.fn().mockResolvedValue(null),
      invalidateAllForUser: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({}),
    };
    useCase = new ResendVerificationUseCase(users as never, email as never, tokens as never, () => NOW);
  });

  it('le lien est valable 48 heures', () => {
    expect(VERIFICATION_TOKEN_TTL_MS).toBe(48 * 3600 * 1000);
  });

  it('envoie un nouveau lien et invalide les anciens', async () => {
    await useCase.execute('u1');
    expect(tokens.invalidateAllForUser).toHaveBeenCalledWith('u1');
    expect(tokens.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', expiresAt: new Date(NOW + VERIFICATION_TOKEN_TTL_MS) }),
    );
    expect(email.sendVerificationEmail).toHaveBeenCalledWith('a@b.com', expect.any(String));
  });

  it('refuse avant 60 secondes en indiquant le delai restant', async () => {
    tokens.findLatestByUser.mockResolvedValue({ createdAt: new Date(NOW - 20_000) });
    const err = await useCase.execute('u1').catch((e) => e);
    expect(err).toBeInstanceOf(TooManyRequestsError);
    expect(err.details).toEqual({ retryAfterSeconds: 40 });
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('accepte apres 60 secondes', async () => {
    tokens.findLatestByUser.mockResolvedValue({ createdAt: new Date(NOW - 61_000) });
    await expect(useCase.execute('u1')).resolves.toEqual({ retryAfterSeconds: 60 });
  });

  it('refuse un email deja verifie', async () => {
    users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', emailVerifiedAt: new Date() });
    await expect(useCase.execute('u1')).rejects.toBeInstanceOf(ValidationError);
  });
});
