import { Prisma, type PrismaClient, type MediaType, type PostVisibility, type PostStatus } from '@prisma/client';

const AUTHOR_SELECT = { id: true, firstName: true, lastName: true, avatar: true } as const;

const POST_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  tags: { include: { tag: true } },
  media: { orderBy: { order: 'asc' as const } },
} satisfies Prisma.PostInclude;

export type PostRecord = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

export interface FeedQuery {
  instanceId: string;
  viewerId: string | null;
  near?: { lat: number; lon: number; radius: number };
  bbox?: [number, number, number, number];
  tagSlugs?: string[];
  authorId?: string;
  sort: 'recent' | 'popular';
  /** recent : dernier (createdAt, id) de la page precedente ; popular : decalage. */
  after?: { createdAt: Date; id: string } | { offset: number };
  limit: number;
}

export interface PostPin {
  id: string;
  lat: number;
  lon: number;
  likeCount: number;
  commentCount: number;
}

export interface NewPost {
  authorId: string;
  instanceId: string;
  content: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  placeLabel: string | null;
  visibility: PostVisibility;
  tagIds: string[];
  media: Array<{ key: string; type: MediaType; order: number }>;
}

const COMMENT_INCLUDE = {
  author: { select: AUTHOR_SELECT },
} satisfies Prisma.PostCommentInclude;

export type PostCommentRecord = Prisma.PostCommentGetPayload<{ include: typeof COMMENT_INCLUDE }>;

/** Publications du fil social (cahier technique 4.4). */
export class PrismaPostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Identifiants d'une page du fil, dans l'ordre. Le filtre de visibilite est applique dans la
   * requete elle-meme (cahier technique 8.3) : PUBLIC publie, plus les brouillons PRIVATE du
   * lecteur ; GROUP attend les groupes (phase 3).
   */
  async findFeedIds(q: FeedQuery): Promise<string[]> {
    const where: Prisma.Sql[] = [
      Prisma.sql`p.instance_id = ${q.instanceId}::uuid`,
      Prisma.sql`p.status = 'PUBLISHED'`,
      q.viewerId
        ? Prisma.sql`(p.visibility = 'PUBLIC' OR (p.visibility = 'PRIVATE' AND p.author_id = ${q.viewerId}::uuid))`
        : Prisma.sql`p.visibility = 'PUBLIC'`,
    ];
    if (q.near) {
      where.push(
        Prisma.sql`ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint(${q.near.lon}, ${q.near.lat}), 4326)::geography, ${q.near.radius})`,
      );
    }
    if (q.bbox) {
      const [minLon, minLat, maxLon, maxLat] = q.bbox;
      where.push(
        Prisma.sql`p.geom && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)::geography`,
      );
    }
    if (q.tagSlugs?.length) {
      where.push(Prisma.sql`EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id = p.id AND t.slug IN (${Prisma.join(q.tagSlugs)}))`);
    }
    if (q.authorId) where.push(Prisma.sql`p.author_id = ${q.authorId}::uuid`);

    let order: Prisma.Sql;
    let offset = 0;
    if (q.sort === 'popular') {
      // Tri alternatif par interactions (RG-E-09).
      order = Prisma.sql`(p.like_count + p.comment_count + p.share_count) DESC, p.created_at DESC, p.id DESC`;
      if (q.after && 'offset' in q.after) offset = q.after.offset;
    } else {
      order = Prisma.sql`p.created_at DESC, p.id DESC`;
      if (q.after && 'createdAt' in q.after) {
        where.push(Prisma.sql`(p.created_at, p.id) < (${q.after.createdAt}, ${q.after.id}::uuid)`);
      }
    }

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id FROM posts p
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY ${order}
      LIMIT ${q.limit} OFFSET ${offset}`;
    return rows.map((r) => r.id);
  }

  /** Epingles de la carte synchronisee : uniquement la position et les compteurs. */
  async findPins(q: Omit<FeedQuery, 'sort' | 'after'>): Promise<PostPin[]> {
    const ids = await this.findFeedIds({ ...q, sort: 'recent' });
    if (!ids.length) return [];
    const rows = await this.prisma.post.findMany({
      where: { id: { in: ids } },
      select: { id: true, lat: true, lon: true, likeCount: true, commentCount: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  }

  async findManyByIds(ids: string[]): Promise<PostRecord[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.post.findMany({ where: { id: { in: ids } }, include: POST_INCLUDE });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is PostRecord => !!r);
  }

  findById(id: string): Promise<PostRecord | null> {
    return this.prisma.post.findUnique({ where: { id }, include: POST_INCLUDE });
  }

  async likedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
    if (!postIds.length) return new Set();
    const rows = await this.prisma.postReaction.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
    return new Set(rows.map((r) => r.postId));
  }

  async create(data: NewPost): Promise<PostRecord> {
    const id = await this.prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          authorId: data.authorId,
          instanceId: data.instanceId,
          content: data.content,
          lat: data.lat,
          lon: data.lon,
          radiusMeters: data.radiusMeters,
          placeLabel: data.placeLabel,
          visibility: data.visibility,
          tags: { create: data.tagIds.map((tagId) => ({ tagId })) },
          media: { create: data.media },
        },
        select: { id: true },
      });
      await this.syncGeom(tx, post.id);
      return post.id;
    });
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    data: { content?: string; placeLabel?: string | null; visibility?: PostVisibility; tagIds?: string[]; edited: boolean },
  ): Promise<PostRecord> {
    await this.prisma.$transaction(async (tx) => {
      if (data.tagIds) {
        await tx.postTag.deleteMany({ where: { postId: id } });
        await tx.postTag.createMany({ data: data.tagIds.map((tagId) => ({ postId: id, tagId })) });
      }
      await tx.post.update({
        where: { id },
        data: {
          ...(data.content !== undefined ? { content: data.content } : {}),
          ...(data.placeLabel !== undefined ? { placeLabel: data.placeLabel } : {}),
          ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
          ...(data.edited ? { editedAt: new Date() } : {}),
        },
      });
    });
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }

  setStatus(id: string, status: PostStatus): Promise<unknown> {
    return this.prisma.post.update({ where: { id }, data: { status } });
  }

  /** J'aime / je n'aime plus (RG-E-04), compteur maintenu dans la meme transaction. */
  toggleLike(postId: string, userId: string): Promise<{ reacted: boolean; likeCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.postReaction.deleteMany({ where: { postId, userId } });
      if (removed.count > 0) {
        const post = await tx.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        return { reacted: false, likeCount: post.likeCount };
      }
      await tx.postReaction.create({ data: { postId, userId } });
      const post = await tx.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { reacted: true, likeCount: post.likeCount };
    });
  }

  async incrementShares(postId: string): Promise<number> {
    const post = await this.prisma.post.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });
    return post.shareCount;
  }

  // --- Commentaires --------------------------------------------------------------------------

  findCommentById(id: string): Promise<PostCommentRecord | null> {
    return this.prisma.postComment.findUnique({ where: { id }, include: COMMENT_INCLUDE });
  }

  /** Commentaires racines (plus recents d'abord), avec leurs reponses (plus anciennes d'abord). */
  async findComments(
    postId: string,
    viewerId: string | null,
    after: { createdAt: Date; id: string } | null,
    limit: number,
  ): Promise<Array<PostCommentRecord & { replies: PostCommentRecord[] }>> {
    const visible: Prisma.PostCommentWhereInput = viewerId
      ? { OR: [{ hidden: false }, { authorId: viewerId }] }
      : { hidden: false };
    return this.prisma.postComment.findMany({
      where: {
        postId,
        parentId: null,
        ...visible,
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      include: {
        ...COMMENT_INCLUDE,
        replies: { where: visible, include: COMMENT_INCLUDE, orderBy: { createdAt: 'asc' }, take: 100 },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  async likedCommentIds(userId: string, commentIds: string[]): Promise<Set<string>> {
    if (!commentIds.length) return new Set();
    const rows = await this.prisma.postCommentLike.findMany({
      where: { userId, commentId: { in: commentIds } },
      select: { commentId: true },
    });
    return new Set(rows.map((r) => r.commentId));
  }

  createComment(data: {
    postId: string;
    authorId: string;
    parentId: string | null;
    content: string;
  }): Promise<PostCommentRecord> {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.postComment.create({ data, include: COMMENT_INCLUDE });
      await tx.post.update({ where: { id: data.postId }, data: { commentCount: { increment: 1 } } });
      return comment;
    });
  }

  /** Supprime un commentaire et ses reponses ; le compteur de la publication suit. */
  deleteComment(id: string, postId: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const replies = await tx.postComment.count({ where: { parentId: id } });
      await tx.postComment.delete({ where: { id } });
      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { decrement: 1 + replies } },
      });
    });
  }

  setCommentHidden(id: string, hidden: boolean): Promise<unknown> {
    return this.prisma.postComment.update({ where: { id }, data: { hidden } });
  }

  toggleCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.postCommentLike.deleteMany({ where: { commentId, userId } });
      const liked = removed.count === 0;
      if (liked) await tx.postCommentLike.create({ data: { commentId, userId } });
      const comment = await tx.postComment.update({
        where: { id: commentId },
        data: { likeCount: liked ? { increment: 1 } : { decrement: 1 } },
        select: { likeCount: true },
      });
      return { liked, likeCount: comment.likeCount };
    });
  }

  // --- Etiquettes ----------------------------------------------------------------------------

  /** Etiquettes globales (ODD) et propres a l'instance. */
  listTags(instanceId: string | null, category?: 'SDG' | 'CUSTOM') {
    return this.prisma.tag.findMany({
      where: {
        ...(category ? { category } : {}),
        OR: [{ instanceId: null }, ...(instanceId ? [{ instanceId }] : [])],
      },
      orderBy: [{ category: 'asc' }, { sdgNumber: 'asc' }, { slug: 'asc' }],
    });
  }

  findTagsBySlugs(slugs: string[]) {
    return this.prisma.tag.findMany({ where: { slug: { in: slugs } } });
  }

  findAuthor(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: AUTHOR_SELECT });
  }

  async isInstanceAdmin(userId: string, instanceId: string): Promise<boolean> {
    const membership = await this.prisma.instanceUser.findUnique({
      where: { userId_instanceId: { userId, instanceId } },
      select: { role: true },
    });
    return membership?.role === 'ADMIN_INSTANCE' || membership?.role === 'SUPER_ADMIN';
  }

  private async syncGeom(tx: Prisma.TransactionClient, id: string): Promise<void> {
    await tx.$executeRaw`UPDATE posts SET geom = ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
      WHERE id = ${id}::uuid`;
  }
}
