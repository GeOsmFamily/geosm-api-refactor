import { PrismaClient } from '@prisma/client';

export interface CommentRecord {
  id: string;
  userId: string;
  instanceId: string;
  text: string;
  lat: number;
  lon: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaCommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { id: string; userId: string; instanceId: string; text: string; lat: number; lon: number }): Promise<CommentRecord> {
    return this.prisma.comment.create({ data }) as Promise<CommentRecord>;
  }

  async findById(id: string): Promise<CommentRecord | null> {
    return this.prisma.comment.findUnique({ where: { id } }) as Promise<CommentRecord | null>;
  }

  async findByInstanceId(instanceId: string): Promise<CommentRecord[]> {
    return this.prisma.comment.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<CommentRecord[]>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.comment.delete({ where: { id } });
  }
}
