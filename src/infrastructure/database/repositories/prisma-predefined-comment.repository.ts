import type { PrismaClient } from '@prisma/client';

export interface PredefinedCommentRecord {
  id: string;
  instanceId: string;
  label: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Commentaires predefinis d'une instance (outil « Ajouter un commentaire », maquette 14). */
export class PrismaPredefinedCommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listByInstance(instanceId: string): Promise<PredefinedCommentRecord[]> {
    return this.prisma.predefinedComment.findMany({
      where: { instanceId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findById(id: string): Promise<PredefinedCommentRecord | null> {
    return this.prisma.predefinedComment.findUnique({ where: { id } });
  }

  async nextOrder(instanceId: string): Promise<number> {
    const last = await this.prisma.predefinedComment.findFirst({
      where: { instanceId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return (last?.order ?? -1) + 1;
  }

  create(data: { instanceId: string; label: string; order: number }): Promise<PredefinedCommentRecord> {
    return this.prisma.predefinedComment.create({ data });
  }

  update(id: string, data: { label?: string; order?: number }): Promise<PredefinedCommentRecord> {
    return this.prisma.predefinedComment.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.predefinedComment.delete({ where: { id } });
  }

  /** Vrai si l'utilisateur administre cette instance (role ADMIN_INSTANCE sur l'instance). */
  async isInstanceAdmin(userId: string, instanceId: string): Promise<boolean> {
    const membership = await this.prisma.instanceUser.findUnique({
      where: { userId_instanceId: { userId, instanceId } },
      select: { role: true },
    });
    return membership?.role === 'ADMIN_INSTANCE' || membership?.role === 'SUPER_ADMIN';
  }
}
