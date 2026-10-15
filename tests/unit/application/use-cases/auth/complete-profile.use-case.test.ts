import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompleteProfileUseCase } from '../../../../../src/application/use-cases/auth/complete-profile.use-case.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';

describe('CompleteProfileUseCase (RG-A-09)', () => {
  let users: {
    findById: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let email: { sendVerificationEmail: ReturnType<typeof vi.fn> };
  let tokens: { invalidateAllForUser: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let useCase: CompleteProfileUseCase;

  beforeEach(() => {
    users = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', email: 'osm-1@users.geosm.local' }),
      findByEmail: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    };
    email = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };
    tokens = { invalidateAllForUser: vi.fn(), create: vi.fn().mockResolvedValue({}) };
    useCase = new CompleteProfileUseCase(users as never, email as never, tokens as never);
  });

  it('confirme le nom sans toucher a l email', async () => {
    await useCase.execute('u1', { firstName: 'Ada', lastName: 'Lovelace' });
    expect(users.update).toHaveBeenCalledWith('u1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      profileCompletionPending: false,
    });
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('un nouvel email est non verifie et declenche la verification', async () => {
    await useCase.execute('u1', { firstName: 'A', lastName: 'B', email: 'Ada@Example.com' });
    expect(users.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ email: 'ada@example.com', emailVerifiedAt: null }),
    );
    expect(email.sendVerificationEmail).toHaveBeenCalledWith('ada@example.com', expect.any(String));
  });

  it('refuse un email deja utilise par un autre compte (RG-A-01)', async () => {
    users.findByEmail.mockResolvedValue({ id: 'other' });
    await expect(
      useCase.execute('u1', { firstName: 'A', lastName: 'B', email: 'taken@example.com' }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(users.update).not.toHaveBeenCalled();
  });
});
