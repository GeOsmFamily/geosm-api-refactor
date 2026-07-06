import { PrismaClient } from '@prisma/client';

export interface EmailVerificationTokenRecord {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export class PrismaEmailVerificationTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { id: string; token: string; userId: string; expiresAt: Date }): Promise<EmailVerificationTokenRecord> {
    return this.prisma.emailVerificationToken.create({ data: { ...data, usedAt: null } });
  }

  async findByToken(token: string): Promise<EmailVerificationTokenRecord | null> {
    return this.prisma.emailVerificationToken.findUnique({ where: { token } });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.emailVerificationToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  /** Invalide tous les tokens en attente d'un utilisateur (après vérification réussie, ou avant
   * d'en émettre un nouveau) - évite qu'un ancien token emailé reste utilisable indéfiniment. */
  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
