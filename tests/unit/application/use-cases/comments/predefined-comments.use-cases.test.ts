import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PredefinedCommentsUseCases } from '../../../../../src/application/use-cases/comments/predefined-comments.use-cases.js';
import { Role } from '../../../../../src/domain/enums.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

const INSTANCE = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('PredefinedCommentsUseCases', () => {
  let repo: Record<string, ReturnType<typeof vi.fn>>;
  let instances: { findById: ReturnType<typeof vi.fn> };
  let useCases: PredefinedCommentsUseCases;

  const superAdmin = { userId: 'sa', role: Role.SUPER_ADMIN };
  const localAdmin = { userId: 'la', role: Role.ADMIN_INSTANCE };

  beforeEach(() => {
    repo = {
      listByInstance: vi.fn().mockResolvedValue([{ id: 'c1', label: 'A', order: 0 }]),
      findById: vi.fn().mockResolvedValue({ id: 'c1', instanceId: INSTANCE }),
      nextOrder: vi.fn().mockResolvedValue(3),
      create: vi.fn().mockImplementation(async (d) => ({ id: 'new', ...d })),
      update: vi.fn().mockImplementation(async (id, d) => ({ id, ...d })),
      delete: vi.fn().mockResolvedValue(undefined),
      isInstanceAdmin: vi.fn().mockImplementation(async (_u: string, i: string) => i === INSTANCE),
    };
    instances = { findById: vi.fn().mockResolvedValue({ id: INSTANCE }) };
    useCases = new PredefinedCommentsUseCases(repo as never, instances as never);
  });

  it('liste publiquement les commentaires d une instance existante', async () => {
    await expect(useCases.list(INSTANCE)).resolves.toHaveLength(1);
    instances.findById.mockResolvedValue(null);
    await expect(useCases.list(INSTANCE)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('ajoute en fin de liste quand l ordre n est pas fourni, libelle nettoye', async () => {
    const created = await useCases.create(superAdmin, INSTANCE, { label: '  Route coupée ' });
    expect(repo.create).toHaveBeenCalledWith({ instanceId: INSTANCE, label: 'Route coupée', order: 3 });
    expect(created.id).toBe('new');
  });

  it('autorise l administrateur de CETTE instance seulement', async () => {
    await expect(useCases.create(localAdmin, INSTANCE, { label: 'x' })).resolves.toBeTruthy();
    await expect(useCases.create(localAdmin, OTHER, { label: 'x' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('refuse un editeur ou un simple utilisateur', async () => {
    await expect(
      useCases.listForAdmin({ userId: 'e', role: Role.EDITOR }, INSTANCE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('ne modifie ni ne supprime un commentaire d une autre instance', async () => {
    repo.findById.mockResolvedValue({ id: 'c9', instanceId: OTHER });
    await expect(useCases.update(superAdmin, INSTANCE, 'c9', { label: 'y' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(useCases.remove(superAdmin, INSTANCE, 'c9')).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('met a jour uniquement les champs fournis', async () => {
    await useCases.update(superAdmin, INSTANCE, 'c1', { order: 7 });
    expect(repo.update).toHaveBeenCalledWith('c1', { order: 7 });
  });
});
