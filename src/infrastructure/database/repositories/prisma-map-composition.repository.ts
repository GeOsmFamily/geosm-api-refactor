import { PrismaClient, Prisma } from '@prisma/client';

export interface MapCompositionRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  instanceId: string;
  layers: Prisma.JsonValue;
  center: Prisma.JsonValue;
  zoom: number;
  isPublic: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaMapCompositionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    instanceId: string;
    layers: Prisma.InputJsonValue;
    center: Prisma.InputJsonValue;
    zoom: number;
    isPublic: boolean;
    userId: string;
  }): Promise<MapCompositionRecord> {
    return this.prisma.mapComposition.create({ data }) as Promise<MapCompositionRecord>;
  }

  async findById(id: string): Promise<MapCompositionRecord | null> {
    return this.prisma.mapComposition.findUnique({ where: { id } }) as Promise<MapCompositionRecord | null>;
  }

  async findByInstanceId(instanceId: string): Promise<MapCompositionRecord[]> {
    return this.prisma.mapComposition.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<MapCompositionRecord[]>;
  }

  async findPublicByInstanceId(instanceId: string): Promise<MapCompositionRecord[]> {
    return this.prisma.mapComposition.findMany({
      where: { instanceId, isPublic: true },
      orderBy: { createdAt: 'desc' },
    }) as Promise<MapCompositionRecord[]>;
  }

  async update(id: string, data: {
    name?: string;
    slug?: string;
    description?: string | null;
    layers?: Prisma.InputJsonValue;
    center?: Prisma.InputJsonValue;
    zoom?: number;
    isPublic?: boolean;
  }): Promise<MapCompositionRecord> {
    return this.prisma.mapComposition.update({ where: { id }, data }) as Promise<MapCompositionRecord>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.mapComposition.delete({ where: { id } });
  }
}
