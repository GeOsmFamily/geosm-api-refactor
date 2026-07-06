import { PrismaClient } from '@prisma/client';

export interface OsmProfileRecord {
  id: string;
  userId: string;
  osmUserId: bigint;
  displayName: string;
  avatarUrl: string | null;
  osmAccountCreatedAt: Date | null;
  changesetCount: number;
  homeLat: number | null;
  homeLon: number | null;
  accessTokenEncrypted: string;
  linkedAt: Date;
  updatedAt: Date;
}

export interface UpsertOsmProfileData {
  userId: string;
  osmUserId: bigint;
  displayName: string;
  avatarUrl: string | null;
  osmAccountCreatedAt: Date | null;
  changesetCount: number;
  homeLat: number | null;
  homeLon: number | null;
  accessTokenEncrypted: string;
}

export class PrismaOsmProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOsmUserId(osmUserId: bigint): Promise<OsmProfileRecord | null> {
    return this.prisma.osmProfile.findUnique({ where: { osmUserId } });
  }

  async findByUserId(userId: string): Promise<OsmProfileRecord | null> {
    return this.prisma.osmProfile.findUnique({ where: { userId } });
  }

  async upsert(id: string, data: UpsertOsmProfileData): Promise<OsmProfileRecord> {
    return this.prisma.osmProfile.upsert({
      where: { userId: data.userId },
      create: { id, ...data },
      update: {
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        osmAccountCreatedAt: data.osmAccountCreatedAt,
        changesetCount: data.changesetCount,
        homeLat: data.homeLat,
        homeLon: data.homeLon,
        accessTokenEncrypted: data.accessTokenEncrypted,
      },
    });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.osmProfile.delete({ where: { userId } });
  }
}
