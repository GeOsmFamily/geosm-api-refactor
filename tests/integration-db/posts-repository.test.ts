import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DB_AVAILABLE, getPrisma, disconnectPrisma } from './setup.js';
import { PrismaPostRepository } from '../../src/infrastructure/database/repositories/prisma-post.repository.js';
import { PrismaContentReportRepository } from '../../src/infrastructure/database/repositories/prisma-content-report.repository.js';

// Requetes reelles du fil social (PostGIS) : distance, emprise, etiquettes, visibilite, curseur.
const instanceId = randomUUID();
const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const YAOUNDE = { lat: 3.8667, lon: 11.5167 };

afterAll(async () => {
  if (DB_AVAILABLE) {
    const prisma = getPrisma();
    await prisma.post.deleteMany({ where: { instanceId } });
    await prisma.tag.deleteMany({ where: { instanceId } });
    await prisma.contentReport.deleteMany({ where: { instanceId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.instance.deleteMany({ where: { id: instanceId } });
    await disconnectPrisma();
  }
});

describe.skipIf(!DB_AVAILABLE)('PrismaPostRepository (PostGIS)', () => {
  let repo: PrismaPostRepository;
  let reports: PrismaContentReportRepository;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const prisma = getPrisma();
    repo = new PrismaPostRepository(prisma);
    reports = new PrismaContentReportRepository(prisma);
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');
    await prisma.instance.create({ data: { id: instanceId, name: 'Test', slug: `test-${instanceId}` } });
    for (const [i, id] of users.entries()) {
      await prisma.user.create({
        data: { id, email: `${id}@test.local`, passwordHash: 'x', firstName: `U${i}`, lastName: 'T' },
      });
    }
    const water = await prisma.tag.create({
      data: { slug: `${instanceId}-eau`, label: 'Eau', category: 'CUSTOM', instanceId },
    });
    const roads = await prisma.tag.create({
      data: { slug: `${instanceId}-route`, label: 'Route', category: 'CUSTOM', instanceId },
    });
    const base = { authorId: users[0], instanceId, radiusMeters: 1500, placeLabel: null, media: [] as never[] };
    // Ordre de creation = ordre chronologique : near1 est le plus ancien.
    ids.near1 = (await repo.create({ ...base, content: 'A 500 m', lat: YAOUNDE.lat + 0.0045, lon: YAOUNDE.lon, visibility: 'PUBLIC', tagIds: [water.id] })).id;
    ids.near2 = (await repo.create({ ...base, content: 'A 2 km', lat: YAOUNDE.lat + 0.018, lon: YAOUNDE.lon, visibility: 'PUBLIC', tagIds: [roads.id] })).id;
    ids.douala = (await repo.create({ ...base, content: 'Douala', lat: 4.0511, lon: 9.7043, visibility: 'PUBLIC', tagIds: [roads.id] })).id;
    ids.private = (await repo.create({ ...base, content: 'Brouillon', lat: YAOUNDE.lat, lon: YAOUNDE.lon, visibility: 'PRIVATE', tagIds: [water.id] })).id;
    ids.flagged = (await repo.create({ ...base, content: 'Masque', lat: YAOUNDE.lat, lon: YAOUNDE.lon, visibility: 'PUBLIC', tagIds: [water.id] })).id;
    await repo.setStatus(ids.flagged, 'FLAGGED');
  }, 60_000);

  const q = (over: Record<string, unknown> = {}) => ({ instanceId, viewerId: null, sort: 'recent' as const, limit: 20, ...over });

  it('renseigne la colonne geographique a la creation', async () => {
    const rows = await getPrisma().$queryRaw<Array<{ ok: boolean }>>`
      SELECT geom IS NOT NULL AS ok FROM posts WHERE id = ${ids.near1}::uuid`;
    expect(rows[0].ok).toBe(true);
  });

  it('fil du pays : publications publiques, plus recentes d abord, sans les masquees', async () => {
    expect(await repo.findFeedIds(q())).toEqual([ids.douala, ids.near2, ids.near1]);
  });

  it('brouillon prive visible de son seul auteur', async () => {
    expect(await repo.findFeedIds(q({ viewerId: users[0] }))).toContain(ids.private);
    expect(await repo.findFeedIds(q({ viewerId: users[1] }))).not.toContain(ids.private);
  });

  it('filtre par distance (ST_DWithin, metres) et par emprise', async () => {
    expect(await repo.findFeedIds(q({ near: { ...YAOUNDE, radius: 1000 } }))).toEqual([ids.near1]);
    expect(await repo.findFeedIds(q({ near: { ...YAOUNDE, radius: 3000 } }))).toEqual([ids.near2, ids.near1]);
    expect(await repo.findFeedIds(q({ bbox: [9.5, 3.9, 10, 4.2] }))).toEqual([ids.douala]);
  });

  it('filtre par etiquette (une au moins)', async () => {
    expect(await repo.findFeedIds(q({ tagSlugs: [`${instanceId}-route`] }))).toEqual([ids.douala, ids.near2]);
  });

  it('pagine par curseur (createdAt, id) sans doublon ni trou', async () => {
    const first = await repo.findFeedIds(q({ limit: 2 }));
    const last = await getPrisma().post.findUnique({ where: { id: first[1] } });
    const second = await repo.findFeedIds(q({ limit: 2, after: { createdAt: last!.createdAt, id: last!.id } }));
    expect([...first, ...second]).toEqual([ids.douala, ids.near2, ids.near1]);
  });

  it("j'aime en bascule, compteur et tri par popularite", async () => {
    expect(await repo.toggleLike(ids.near1, users[1])).toEqual({ reacted: true, likeCount: 1 });
    expect(await repo.toggleLike(ids.near1, users[2])).toEqual({ reacted: true, likeCount: 2 });
    expect(await repo.toggleLike(ids.near1, users[2])).toEqual({ reacted: false, likeCount: 1 });
    expect((await repo.findFeedIds(q({ sort: 'popular' })))[0]).toBe(ids.near1);
    expect(await repo.likedPostIds(users[1], [ids.near1, ids.near2])).toEqual(new Set([ids.near1]));
  });

  it('commentaires : compteur, reponses et suppression en cascade', async () => {
    const root = await repo.createComment({ postId: ids.near2, authorId: users[1], parentId: null, content: 'Racine' });
    await repo.createComment({ postId: ids.near2, authorId: users[2], parentId: root.id, content: 'Reponse' });
    const page = await repo.findComments(ids.near2, null, null, 10);
    expect(page).toHaveLength(1);
    expect(page[0].replies.map((r) => r.content)).toEqual(['Reponse']);
    expect((await repo.findById(ids.near2))!.commentCount).toBe(2);
    await repo.deleteComment(root.id, ids.near2);
    expect((await repo.findById(ids.near2))!.commentCount).toBe(0);
  });

  it('un signalement par utilisateur, compte des signaleurs distincts', async () => {
    const report = (reporterId: string) =>
      reports.report({ targetType: 'POST', targetId: ids.near2, instanceId, reporterId, reason: 'SPAM', details: null });
    expect(await report(users[1])).toEqual({ created: true, openReports: 1 });
    expect(await report(users[1])).toEqual({ created: false, openReports: 1 });
    expect(await report(users[2])).toEqual({ created: true, openReports: 2 });
    expect((await reports.listOpen(instanceId))[0]).toMatchObject({ targetId: ids.near2, reportCount: 2, reasons: ['SPAM'] });
    await reports.resolve('POST', ids.near2, users[3]);
    expect(await reports.listOpen(instanceId)).toEqual([]);
  });
});
