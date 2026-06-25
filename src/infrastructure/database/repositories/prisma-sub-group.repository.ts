import { PrismaClient, SubGroup as PrismaSubGroup } from '@prisma/client';
import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { SubGroup } from '../../../domain/entities/sub-group.entity.js';

export class PrismaSubGroupRepository implements ISubGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<SubGroup | null> {
    const record = await this.prisma.subGroup.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findBySlug(slug: string, groupId: string): Promise<SubGroup | null> {
    const record = await this.prisma.subGroup.findUnique({ where: { slug_groupId: { slug, groupId } } });
    return record ? this.toDomain(record) : null;
  }

  async findByGroup(groupId: string): Promise<SubGroup[]> {
    const records = await this.prisma.subGroup.findMany({ where: { groupId }, orderBy: { order: 'asc' } });
    return records.map(r => this.toDomain(r));
  }

  async create(data: Omit<SubGroup, 'createdAt' | 'updatedAt'>): Promise<SubGroup> {
    const record = await this.prisma.subGroup.create({
      data: {
        id: data.id, name: data.name, slug: data.slug, description: data.description,
        icon: data.icon, order: data.order, isActive: data.isActive, groupId: data.groupId,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: Partial<Omit<SubGroup, 'id' | 'createdAt' | 'updatedAt'>>): Promise<SubGroup> {
    const record = await this.prisma.subGroup.update({ where: { id }, data });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.subGroup.delete({ where: { id } });
  }

  private toDomain(record: PrismaSubGroup): SubGroup {
    return new SubGroup({
      id: record.id, name: record.name, slug: record.slug, description: record.description,
      icon: record.icon, order: record.order, isActive: record.isActive,
      groupId: record.groupId, createdAt: record.createdAt, updatedAt: record.updatedAt,
    });
  }
}
