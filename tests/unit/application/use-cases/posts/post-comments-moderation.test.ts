import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostCommentsUseCases } from '../../../../../src/application/use-cases/posts/post-comments.use-cases.js';
import { PostModerationUseCases } from '../../../../../src/application/use-cases/posts/post-moderation.use-cases.js';
import { detectMediaFormat, PostMediaUseCase } from '../../../../../src/application/use-cases/posts/post-media.use-case.js';
import { Role } from '../../../../../src/domain/enums.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';

const AUTHOR = '22222222-2222-4222-8222-222222222222';
const READER = '33333333-3333-4333-8333-333333333333';
const THIRD = '44444444-4444-4444-8444-444444444444';
const reader = { userId: READER, role: Role.VIEWER };

const comment = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  postId: 'p1',
  parentId: null,
  authorId: THIRD,
  author: { id: THIRD, firstName: 'Awa', lastName: 'N', avatar: null },
  content: 'Merci',
  likeCount: 0,
  hidden: false,
  editedAt: null,
  createdAt: new Date(),
  ...over,
});

describe('PostCommentsUseCases', () => {
  let repo: Record<string, ReturnType<typeof vi.fn>>;
  let posts: { get: ReturnType<typeof vi.fn> };
  let notifier: { notifyUser: ReturnType<typeof vi.fn> };
  let useCases: PostCommentsUseCases;

  beforeEach(() => {
    repo = {
      findCommentById: vi.fn(async () => comment({ id: 'reply', parentId: 'root' })),
      createComment: vi.fn(async (d: Record<string, unknown>) => comment({ ...d, id: 'new', author: { id: READER, firstName: 'Paul', lastName: 'T', avatar: null } })),
      isInstanceAdmin: vi.fn(async () => false),
      deleteComment: vi.fn(),
    };
    posts = { get: vi.fn(async () => ({ id: 'p1', instanceId: 'i1', author: { id: AUTHOR } })) };
    notifier = { notifyUser: vi.fn(async () => undefined) };
    useCases = new PostCommentsUseCases(repo as never, posts as never, notifier);
  });

  it('rattache une reponse a une reponse au commentaire racine (RG-E-05)', async () => {
    await useCases.create('p1', reader, { content: ' Oui ', parentId: 'reply' }, 'fr');
    expect(repo.createComment).toHaveBeenCalledWith({ postId: 'p1', authorId: READER, parentId: 'root', content: 'Oui' });
  });

  it("notifie l'auteur de la publication et celui du commentaire repondu", async () => {
    await useCases.create('p1', reader, { content: 'Oui', parentId: 'reply' }, 'fr');
    const recipients = notifier.notifyUser.mock.calls.map((c) => c[0]).sort();
    expect(recipients).toEqual([AUTHOR, THIRD].sort());
    expect(notifier.notifyUser.mock.calls[0][1]).toBe('POST_COMMENTED');
  });

  it("refuse la suppression a un tiers, l'accepte a l'auteur de la publication", async () => {
    repo.findCommentById.mockResolvedValue(comment());
    await expect(useCases.remove('c1', reader, 'fr')).rejects.toBeInstanceOf(ForbiddenError);
    await useCases.remove('c1', { userId: AUTHOR, role: Role.VIEWER }, 'fr');
    expect(repo.deleteComment).toHaveBeenCalledWith('c1', 'p1');
  });
});

describe('PostModerationUseCases', () => {
  let posts: Record<string, ReturnType<typeof vi.fn>>;
  let reports: Record<string, ReturnType<typeof vi.fn>>;
  let notifier: { notifyUser: ReturnType<typeof vi.fn> };
  let useCases: PostModerationUseCases;

  beforeEach(() => {
    posts = {
      findById: vi.fn(async () => ({ id: 'p1', authorId: AUTHOR, instanceId: 'i1', status: 'PUBLISHED', content: 'Texte', author: null })),
      setStatus: vi.fn(),
      isInstanceAdmin: vi.fn(async () => false),
    };
    reports = { report: vi.fn(async () => ({ created: true, openReports: 1 })), resolve: vi.fn() };
    notifier = { notifyUser: vi.fn(async () => undefined) };
    useCases = new PostModerationUseCases(posts as never, reports as never, { findById: vi.fn(async () => ({ id: 'i1' })) } as never, notifier);
  });

  it('masque la publication au troisieme signaleur distinct (RG-E-06)', async () => {
    reports.report.mockResolvedValueOnce({ created: true, openReports: 2 });
    await useCases.reportPost('p1', reader, { reason: 'SPAM' });
    expect(posts.setStatus).not.toHaveBeenCalled();
    reports.report.mockResolvedValueOnce({ created: true, openReports: 3 });
    await useCases.reportPost('p1', reader, { reason: 'SPAM' });
    expect(posts.setStatus).toHaveBeenCalledWith('p1', 'FLAGGED');
  });

  it("refuse qu'un auteur signale sa propre publication", async () => {
    await expect(useCases.reportPost('p1', { userId: AUTHOR, role: Role.VIEWER }, { reason: 'SPAM' })).rejects.toBeInstanceOf(ValidationError);
  });

  it("retire une publication, clot les signalements et previent l'auteur", async () => {
    await expect(useCases.reviewPost('p1', reader, 'REJECT')).rejects.toBeInstanceOf(ForbiddenError);
    const result = await useCases.reviewPost('p1', { userId: READER, role: Role.SUPER_ADMIN }, 'REJECT', 'Hors sujet');
    expect(result.status).toBe('REMOVED');
    expect(reports.resolve).toHaveBeenCalledWith('POST', 'p1', READER);
    expect(notifier.notifyUser).toHaveBeenCalledWith(AUTHOR, 'POST_MODERATED', expect.objectContaining({ decision: 'REJECT', note: 'Hors sujet' }));
  });
});

describe('PostMediaUseCase', () => {
  const jpeg = Buffer.from('ffd8ffe000104a464946', 'hex');
  const gif = Buffer.from('GIF89a......');

  it('reconnait le format reel par les premiers octets', () => {
    expect(detectMediaFormat(jpeg)?.type).toBe('IMAGE');
    expect(detectMediaFormat(gif)?.type).toBe('GIF');
    expect(detectMediaFormat(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
  });

  it("range le fichier sous le dossier de l'auteur et refuse les formats inconnus", async () => {
    const store = { uploadFile: vi.fn(async (k: string) => k), getPresignedUrl: vi.fn(async (k: string) => `u/${k}`) };
    const result = await new PostMediaUseCase(store).upload(AUTHOR, jpeg);
    expect(result.key).toMatch(new RegExp(`^posts/${AUTHOR}/[0-9a-f-]+\\.jpg$`));
    expect(store.uploadFile).toHaveBeenCalledWith(result.key, jpeg, 'image/jpeg', jpeg.length);
    await expect(new PostMediaUseCase(store).upload(AUTHOR, Buffer.from('hello'))).rejects.toBeInstanceOf(ValidationError);
  });
});
