import { PrismaClient } from '@prisma/client';

export interface GeosignetRecord {
  id: string;
  userId: string;
  name: string;
  center: number[];
  zoom: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaGeosignetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { id: string; userId: string; name: string; center: number[]; zoom: number }): Promise<GeosignetRecord> {
    return this.prisma.geosignet.create({ data }) as Promise<GeosignetRecord>;
  }

  async findById(id: string): Promise<GeosignetRecord | null> {
    return this.prisma.geosignet.findUnique({ where: { id } }) as Promise<GeosignetRecord | null>;
  }

  async findByUserId(userId: string): Promise<GeosignetRecord[]> {
    return this.prisma.geosignet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<GeosignetRecord[]>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.geosignet.delete({ where: { id } });
  }
}
