import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostsUseCases } from '../../../../../src/application/use-cases/posts/posts.use-cases.js';
import { Role } from '../../../../../src/domain/enums.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

const INSTANCE = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const actor = { userId: USER, role: Role.VIEWER };
const other = { userId: OTHER, role: Role.VIEWER };

const sdg = (n: number) => ({ id: `sdg${n}`, slug: `sdg-${n}`, category: 'SDG', instanceId: null, label: '{"fr":"ODD"}', sdgNumber: n, color: null, icon: null });
const custom = (slug: string, instanceId: string | null = INSTANCE) => ({ id: slug, slug, category: 'CUSTOM', instanceId, label: slug, sdgNumber: null, color: null, icon: null });

function postRecord(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    authorId: USER,
    author: { id: USER, firstName: 'Ada', lastName: 'L', avatar: null },
    instanceId: INSTANCE,
    groupId: null,
    content: 'Texte',
    lat: 3.86,
    lon: 11.51,
    radiusMeters: 1500,
    placeLabel: null,
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    editedAt: null,
    createdAt: new Date('2026-10-17T10:00:00Z'),
    tags: [],
    media: [],
    ...over,
  };
}

describe('PostsUseCases', () => {
  let repo: Record<string, ReturnType<typeof vi.fn>>;
  let instances: { findById: ReturnType<typeof vi.fn> };
  let media: Record<string, ReturnType<typeof vi.fn>>;
  let notifier: { notifyUser: ReturnType<typeof vi.fn> };
  let useCases: PostsUseCases;
  const input = { content: ' Point d’eau installé ', lat: 3.86, lon: 11.51, tagSlugs: ['sdg-6'] };

  beforeEach(() => {
    repo = {
      findTagsBySlugs: vi.fn(async (slugs: string[]) =>
        slugs.map((s) => (s.startsWith('sdg-') ? sdg(Number(s.slice(4))) : custom(s))),
      ),
      create: vi.fn(async () => postRecord()),
      findById: vi.fn(async () => postRecord()),
      likedPostIds: vi.fn(async () => new Set<string>()),
      toggleLike: vi.fn(async () => ({ reacted: true, likeCount: 1 })),
      findAuthor: vi.fn(async () => ({ id: OTHER, firstName: 'Bob', lastName: 'K', avatar: null })),
      isInstanceAdmin: vi.fn(async () => false),
      update: vi.fn(async () => postRecord({ editedAt: new Date() })),
      delete: vi.fn(),
      findFeedIds: vi.fn(async () => []),
      findManyByIds: vi.fn(async () => []),
    };
    instances = { findById: vi.fn(async () => ({ id: INSTANCE, bbox: [8.4, 1.6, 16.2, 13.1] })) };
    media = {
      fileExists: vi.fn(async () => true),
      getPresignedUrl: vi.fn(async (k: string) => `https://minio/${k}`),
      deleteFile: vi.fn(async () => undefined),
    };
    notifier = { notifyUser: vi.fn(async () => undefined) };
    useCases = new PostsUseCases(repo as never, instances as never, media as never, notifier);
  });

  it('cree une publication avec texte nettoye et rayon par defaut', async () => {
    await useCases.create(INSTANCE, actor, input, 'fr');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Point d’eau installé', radiusMeters: 1500, visibility: 'PUBLIC', tagIds: ['sdg6'] }),
    );
  });

  it('exige au moins un ODD ou une etiquette (RG-E-02)', async () => {
    await expect(useCases.create(INSTANCE, actor, { ...input, tagSlugs: [] }, 'fr')).rejects.toBeInstanceOf(ValidationError);
  });

  it('limite a cinq ODD mais accepte des etiquettes en plus (RG-E-03)', async () => {
    const six = [1, 2, 3, 4, 5, 6].map((n) => `sdg-${n}`);
    await expect(useCases.create(INSTANCE, actor, { ...input, tagSlugs: six }, 'fr')).rejects.toThrow('5 sujets ODD');
    await useCases.create(INSTANCE, actor, { ...input, tagSlugs: [...six.slice(0, 5), 'travaux', 'histoire'] }, 'fr');
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('borne le rayon entre 100 m et 25 km (RG-E-01)', async () => {
    await expect(useCases.create(INSTANCE, actor, { ...input, radiusMeters: 50 }, 'fr')).rejects.toBeInstanceOf(ValidationError);
    await expect(useCases.create(INSTANCE, actor, { ...input, radiusMeters: 25_001 }, 'fr')).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse un lieu hors du pays et une etiquette d un autre pays', async () => {
    await expect(useCases.create(INSTANCE, actor, { ...input, lat: 48.85, lon: 2.35 }, 'fr')).rejects.toThrow('hors du pays');
    repo.findTagsBySlugs.mockResolvedValueOnce([custom('ailleurs', 'autre-instance')]);
    await expect(useCases.create(INSTANCE, actor, { ...input, tagSlugs: ['ailleurs'] }, 'fr')).rejects.toThrow('Etiquette inconnue');
  });

  it("n'accepte que les medias televerses par l'auteur", async () => {
    await expect(
      useCases.create(INSTANCE, actor, { ...input, media: [{ key: `posts/${OTHER}/x.jpg`, type: 'IMAGE' }] }, 'fr'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await useCases.create(INSTANCE, actor, { ...input, media: [{ key: `posts/${USER}/x.jpg`, type: 'IMAGE' }] }, 'fr');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ media: [{ key: `posts/${USER}/x.jpg`, type: 'IMAGE', order: 0 }] }));
  });

  it('refuse les publications de groupe tant que les groupes n existent pas', async () => {
    await expect(useCases.create(INSTANCE, actor, { ...input, visibility: 'GROUP' }, 'fr')).rejects.toBeInstanceOf(ValidationError);
  });

  it("notifie l'auteur quand un autre utilisateur aime, pas quand il s'aime lui-meme", async () => {
    await useCases.toggleLike('p1', other);
    expect(notifier.notifyUser).toHaveBeenCalledWith(USER, 'POST_LIKED', expect.objectContaining({ postId: 'p1', likedByName: 'Bob K' }));
    notifier.notifyUser.mockClear();
    await useCases.toggleLike('p1', actor);
    expect(notifier.notifyUser).not.toHaveBeenCalled();
  });

  it('cache une publication masquee ou privee aux autres lecteurs', async () => {
    repo.findById.mockResolvedValue(postRecord({ status: 'FLAGGED' }));
    await expect(useCases.get('p1', other, 'fr')).rejects.toBeInstanceOf(NotFoundError);
    await expect(useCases.get('p1', null, 'fr')).rejects.toBeInstanceOf(NotFoundError);
    expect((await useCases.get('p1', actor, 'fr')).isAuthor).toBe(true);
    repo.findById.mockResolvedValue(postRecord({ visibility: 'PRIVATE' }));
    await expect(useCases.get('p1', other, 'fr')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('marque la publication modifiee seulement si le texte change (RG-E-07)', async () => {
    await useCases.update('p1', actor, { content: 'Texte' }, 'fr');
    expect(repo.update).toHaveBeenLastCalledWith('p1', expect.objectContaining({ edited: false }));
    await useCases.update('p1', actor, { content: 'Nouveau texte' }, 'fr');
    expect(repo.update).toHaveBeenLastCalledWith('p1', expect.objectContaining({ edited: true }));
    await expect(useCases.update('p1', other, { content: 'x' }, 'fr')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("supprime par l'auteur ou un administrateur de l'instance, et nettoie les medias", async () => {
    repo.findById.mockResolvedValue(postRecord({ media: [{ key: 'posts/u/a.jpg', type: 'IMAGE', order: 0 }] }));
    await expect(useCases.remove('p1', other)).rejects.toBeInstanceOf(ForbiddenError);
    repo.isInstanceAdmin.mockResolvedValue(true);
    await useCases.remove('p1', { userId: OTHER, role: Role.ADMIN_INSTANCE });
    expect(repo.delete).toHaveBeenCalledWith('p1');
    expect(media.deleteFile).toHaveBeenCalledWith('posts/u/a.jpg');
  });

  it('pagine le fil par curseur opaque et sans position couvre tout le pays', async () => {
    repo.findFeedIds.mockResolvedValue(['p1', 'p2', 'p3']);
    repo.findManyByIds.mockImplementation(async (ids: string[]) => ids.map((id) => postRecord({ id })));
    const page = await useCases.feed(INSTANCE, null, { limit: 2 }, 'fr');
    expect(repo.findFeedIds).toHaveBeenCalledWith(expect.objectContaining({ near: undefined, limit: 3, viewerId: null }));
    expect(page.items.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(page.items[0].viewerHasLiked).toBeUndefined();
    expect(page.hasMore).toBe(true);
    await useCases.feed(INSTANCE, null, { limit: 2, cursor: page.nextCursor!, lat: 3.8, lon: 11.5, radius: 90_000 }, 'fr');
    expect(repo.findFeedIds).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: { createdAt: expect.any(Date), id: 'p2' }, near: { lat: 3.8, lon: 11.5, radius: 50_000 } }),
    );
  });
});
