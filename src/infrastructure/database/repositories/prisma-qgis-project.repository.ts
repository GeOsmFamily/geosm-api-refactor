import { PrismaClient, QgisProject as PrismaQgisProject } from '@prisma/client';
import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QgisProject } from '../../../domain/entities/qgis-project.entity.js';

export class PrismaQgisProjectRepository implements IQgisProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByInstanceId(instanceId: string): Promise<QgisProject[]> {
    const records = await this.prisma.qgisProject.findMany({ where: { instanceId }, orderBy: { createdAt: 'asc' } });
    return records.map(r => this.toDomain(r));
  }

  async findById(id: string): Promise<QgisProject | null> {
    const record = await this.prisma.qgisProject.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async create(data: Omit<QgisProject, 'createdAt' | 'updatedAt'>): Promise<QgisProject> {
    const record = await this.prisma.qgisProject.create({
      data: {
        id: data.id,
        name: data.name,
        filePath: data.filePath,
        description: data.description,
        instanceId: data.instanceId,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: Partial<Omit<QgisProject, 'id' | 'createdAt' | 'updatedAt'>>): Promise<QgisProject> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.filePath !== undefined) updateData.filePath = data.filePath;
    if (data.description !== undefined) updateData.description = data.description;
    const record = await this.prisma.qgisProject.update({ where: { id }, data: updateData });
    return this.toDomain(record);
  }

  private toDomain(record: PrismaQgisProject): QgisProject {
    return new QgisProject({
      id: record.id,
      name: record.name,
      filePath: record.filePath,
      description: record.description,
      instanceId: record.instanceId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
