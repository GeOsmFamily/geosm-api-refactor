import { PrismaClient } from '@prisma/client';

export interface PasswordResetTokenRecord {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export class PrismaPasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenRecord> {
    return this.prisma.passwordResetToken.create({ data: { ...data, usedAt: null } });
  }

  async findByToken(token: string): Promise<PasswordResetTokenRecord | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { token } });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  /** Invalide tous les tokens en attente d'un utilisateur (après un reset réussi, ou avant
   * d'en émettre un nouveau) - évite qu'un ancien token emailé reste utilisable indéfiniment. */
  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
