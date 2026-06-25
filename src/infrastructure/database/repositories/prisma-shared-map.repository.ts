import { PrismaClient, Prisma } from '@prisma/client';

export interface SharedMapRecord {
  id: string;
  userId: string;
  instanceId: string;
  mapState: Prisma.JsonValue;
  shortCode: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export class PrismaSharedMapRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { id: string; userId: string; instanceId: string; mapState: Prisma.InputJsonValue; shortCode: string; expiresAt: Date | null }): Promise<SharedMapRecord> {
    return this.prisma.sharedMap.create({ data }) as Promise<SharedMapRecord>;
  }

  async findByShortCode(shortCode: string): Promise<SharedMapRecord | null> {
    return this.prisma.sharedMap.findUnique({ where: { shortCode } }) as Promise<SharedMapRecord | null>;
  }
}
