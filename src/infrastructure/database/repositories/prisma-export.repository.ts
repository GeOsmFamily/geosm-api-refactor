import { PrismaClient, Export as PrismaExport, Prisma } from '@prisma/client';
import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { Export } from '../../../domain/entities/export.entity.js';
import { ExportFormat, JobStatus } from '../../../domain/enums.js';

export class PrismaExportRepository implements IExportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Export | null> {
    const record = await this.prisma.export.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByUser(userId: string, options?: { page?: number; limit?: number; status?: JobStatus }): Promise<{ data: Export[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ExportWhereInput = { userId };
    if (options?.status) where.status = options.status;

    const [records, total] = await Promise.all([
      this.prisma.export.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.export.count({ where }),
    ]);

    return { data: records.map(r => this.toDomain(r)), total };
  }

  async create(data: Omit<Export, 'createdAt' | 'updatedAt'>): Promise<Export> {
    const record = await this.prisma.export.create({
      data: {
        id: data.id,
        format: data.format,
        status: data.status,
        layerId: data.layerId,
        userId: data.userId,
        filePath: data.filePath,
        fileSize: data.fileSize,
        bbox: data.bbox ?? [],
        errorMessage: data.errorMessage,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: Partial<Omit<Export, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Export> {
    const updateData: Prisma.ExportUpdateInput = {};
    if (data.format !== undefined) updateData.format = data.format;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.filePath !== undefined) updateData.filePath = data.filePath;
    if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
    if (data.startedAt !== undefined) updateData.startedAt = data.startedAt;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.bbox !== undefined) updateData.bbox = data.bbox ?? [];
    const record = await this.prisma.export.update({ where: { id }, data: updateData });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.export.delete({ where: { id } });
  }

  async count(): Promise<number> {
    return this.prisma.export.count();
  }

  private toDomain(record: PrismaExport): Export {
    return new Export({
      id: record.id,
      format: record.format as ExportFormat,
      status: record.status as JobStatus,
      layerId: record.layerId,
      userId: record.userId,
      filePath: record.filePath,
      fileSize: record.fileSize,
      bbox: record.bbox as number[],
      errorMessage: record.errorMessage,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
