import {
  PrismaClient,
  PersonalLayerSourceType,
  PersonalLayerStatus,
  GeometryType,
  Prisma,
} from '@prisma/client';

export interface PersonalLayerRecord {
  id: string;
  userId: string;
  instanceId: string;
  name: string;
  description: string | null;
  groupName: string;
  subGroupName: string;
  geometryType: GeometryType | null;
  sourceType: PersonalLayerSourceType;
  schemaName: string | null;
  tableName: string | null;
  qgisProjectPath: string | null;
  sourceLayerName: string | null;
  style: Prisma.JsonValue | null;
  status: PersonalLayerStatus;
  publicationNote: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  publishedLayerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePersonalLayerData {
  id: string;
  userId: string;
  instanceId: string;
  name: string;
  description?: string | null;
  groupName: string;
  subGroupName: string;
  geometryType?: GeometryType | null;
  sourceType: PersonalLayerSourceType;
  schemaName?: string | null;
  tableName?: string | null;
  qgisProjectPath?: string | null;
  sourceLayerName?: string | null;
  style?: Prisma.InputJsonValue;
}

export class PrismaPersonalLayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreatePersonalLayerData): Promise<PersonalLayerRecord> {
    return this.prisma.personalLayer.create({ data });
  }

  findById(id: string): Promise<PersonalLayerRecord | null> {
    return this.prisma.personalLayer.findUnique({ where: { id } });
  }

  listForUser(userId: string, instanceId: string): Promise<PersonalLayerRecord[]> {
    return this.prisma.personalLayer.findMany({
      where: { userId, instanceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listPendingForInstance(instanceId: string): Promise<PersonalLayerRecord[]> {
    return this.prisma.personalLayer.findMany({
      where: { instanceId, status: PersonalLayerStatus.PENDING_PUBLICATION },
      orderBy: { createdAt: 'asc' },
    });
  }

  delete(id: string): Promise<PersonalLayerRecord> {
    return this.prisma.personalLayer.delete({ where: { id } });
  }

  updateStatus(
    id: string,
    data: {
      status: PersonalLayerStatus;
      reviewedBy: string;
      reviewNote?: string | null;
      publishedLayerId?: string | null;
    },
  ): Promise<PersonalLayerRecord> {
    return this.prisma.personalLayer.update({
      where: { id },
      data: { ...data, reviewedAt: new Date() },
    });
  }

  updateStyle(
    id: string,
    style: { color?: string; iconKey?: string; shape?: string; qmlPath?: string },
  ): Promise<PersonalLayerRecord> {
    return this.prisma.personalLayer.update({
      where: { id },
      data: { style },
    });
  }

  updateOverrides(
    id: string,
    data: { name?: string; groupName?: string; subGroupName?: string },
  ): Promise<PersonalLayerRecord> {
    return this.prisma.personalLayer.update({ where: { id }, data });
  }

  requestPublication(id: string, publicationNote?: string | null): Promise<PersonalLayerRecord> {
    return this.prisma.personalLayer.update({
      where: { id },
      data: { status: PersonalLayerStatus.PENDING_PUBLICATION, publicationNote },
    });
  }
}
