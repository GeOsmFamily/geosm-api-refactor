import { PrismaClient, Prisma } from '@prisma/client';

export interface DrawingRecord {
  id: string;
  userId: string;
  instanceId: string;
  name: string;
  geojson: Prisma.JsonValue;
  description: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaDrawingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    id: string;
    userId: string;
    instanceId: string;
    name: string;
    geojson: Prisma.InputJsonValue;
    description: string | null;
    isPublic: boolean;
  }): Promise<DrawingRecord> {
    return this.prisma.drawing.create({ data }) as Promise<DrawingRecord>;
  }

  async findById(id: string): Promise<DrawingRecord | null> {
    return this.prisma.drawing.findUnique({ where: { id } }) as Promise<DrawingRecord | null>;
  }

  async findByUserId(userId: string, instanceId: string): Promise<DrawingRecord[]> {
    return this.prisma.drawing.findMany({
      where: { userId, instanceId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<DrawingRecord[]>;
  }

  async update(
    id: string,
    data: {
      name?: string;
      geojson?: Prisma.InputJsonValue;
      description?: string | null;
      isPublic?: boolean;
    },
  ): Promise<DrawingRecord> {
    return this.prisma.drawing.update({ where: { id }, data }) as Promise<DrawingRecord>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.drawing.delete({ where: { id } });
  }
}
