import { PrismaClient } from '@prisma/client';

export interface DocumentRecord {
  id: string;
  name: string;
  description: string | null;
  filePath: string;
  fileSize: number;
  mimeType: string;
  layerId: string | null;
  instanceId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaDocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    id: string;
    name: string;
    description: string | null;
    filePath: string;
    fileSize: number;
    mimeType: string;
    layerId: string | null;
    instanceId: string;
    userId: string;
  }): Promise<DocumentRecord> {
    return this.prisma.document.create({ data }) as Promise<DocumentRecord>;
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    return this.prisma.document.findUnique({ where: { id } }) as Promise<DocumentRecord | null>;
  }

  async findByInstanceId(instanceId: string): Promise<DocumentRecord[]> {
    return this.prisma.document.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<DocumentRecord[]>;
  }

  async findByLayerId(layerId: string): Promise<DocumentRecord[]> {
    return this.prisma.document.findMany({
      where: { layerId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<DocumentRecord[]>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.document.delete({ where: { id } });
  }
}
