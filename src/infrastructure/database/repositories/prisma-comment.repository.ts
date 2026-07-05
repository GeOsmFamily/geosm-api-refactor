import { PrismaClient } from '@prisma/client';

export interface CommentRecord {
  id: string;
  userId: string;
  instanceId: string;
  text: string;
  lat: number;
  lon: number;
  parentId: string | null;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorName?: string;
  replies?: CommentRecord[];
}

const authorSelect = { user: { select: { firstName: true, lastName: true } } };

function withAuthorName<T extends { user?: { firstName: string; lastName: string } | null }>(
  record: T,
): Omit<T, 'user'> & { authorName?: string } {
  const { user, ...rest } = record;
  return { ...rest, authorName: user ? `${user.firstName} ${user.lastName}` : undefined };
}

export class PrismaCommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    id: string;
    userId: string;
    instanceId: string;
    text: string;
    lat: number;
    lon: number;
    parentId?: string | null;
  }): Promise<CommentRecord> {
    const record = await this.prisma.comment.create({ data, include: authorSelect });
    return withAuthorName(record) as CommentRecord;
  }

  async findById(id: string): Promise<CommentRecord | null> {
    const record = await this.prisma.comment.findUnique({ where: { id }, include: authorSelect });
    return record ? (withAuthorName(record) as CommentRecord) : null;
  }

  // Ne remonte que les commentaires racines (parentId null) - un commentaire "réponse" n'a
  // pas son propre pin sur la carte, il n'a de sens qu'imbriqué sous son parent (voir
  // "replies" ci-dessous).
  async findByInstanceId(instanceId: string): Promise<CommentRecord[]> {
    const records = await this.prisma.comment.findMany({
      where: { instanceId, parentId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        ...authorSelect,
        replies: { orderBy: { createdAt: 'asc' }, include: authorSelect },
      },
    });
    return records.map((r) => {
      const { replies, ...rest } = r;
      return {
        ...(withAuthorName(rest) as CommentRecord),
        replies: replies.map((reply) => withAuthorName(reply) as CommentRecord),
      };
    });
  }

  async setResolved(id: string, resolved: boolean): Promise<CommentRecord> {
    const record = await this.prisma.comment.update({ where: { id }, data: { resolved }, include: authorSelect });
    return withAuthorName(record) as CommentRecord;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.comment.delete({ where: { id } });
  }
}
