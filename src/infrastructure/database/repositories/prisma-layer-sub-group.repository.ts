import { PrismaClient, LayerSubGroup as PrismaLayerSubGroup } from '@prisma/client';
import { ILayerSubGroupRepository } from '../../../domain/repositories/layer-sub-group.repository.js';
import { LayerSubGroup } from '../../../domain/entities/layer-sub-group.entity.js';

export class PrismaLayerSubGroupRepository implements ILayerSubGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<LayerSubGroup | null> {
    const record = await this.prisma.layerSubGroup.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findBySlug(slug: string, groupId: string): Promise<LayerSubGroup | null> {
    const record = await this.prisma.layerSubGroup.findUnique({
      where: { slug_groupId: { slug, groupId } },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByLayerGroup(groupId: string): Promise<LayerSubGroup[]> {
    const records = await this.prisma.layerSubGroup.findMany({
      where: { groupId },
      orderBy: { order: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(data: Omit<LayerSubGroup, 'createdAt' | 'updatedAt'>): Promise<LayerSubGroup> {
    const record = await this.prisma.layerSubGroup.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        order: data.order,
        isActive: data.isActive,
        groupId: data.groupId,
      },
    });
    return this.toDomain(record);
  }

  async update(
    id: string,
    data: Partial<Omit<LayerSubGroup, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<LayerSubGroup> {
    const record = await this.prisma.layerSubGroup.update({ where: { id }, data });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.layerSubGroup.delete({ where: { id } });
  }

  private toDomain(record: PrismaLayerSubGroup): LayerSubGroup {
    return new LayerSubGroup({
      id: record.id,
      name: record.name,
      slug: record.slug,
      description: record.description,
      icon: record.icon,
      order: record.order,
      isActive: record.isActive,
      groupId: record.groupId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
