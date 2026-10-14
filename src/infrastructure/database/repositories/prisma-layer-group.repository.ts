import { PrismaClient, LayerGroup as PrismaLayerGroup } from '@prisma/client';
import { ILayerGroupRepository } from '../../../domain/repositories/layer-group.repository.js';
import { LayerGroup } from '../../../domain/entities/layer-group.entity.js';

export class PrismaLayerGroupRepository implements ILayerGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<LayerGroup | null> {
    const record = await this.prisma.layerGroup.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findBySlug(slug: string, instanceId: string): Promise<LayerGroup | null> {
    const record = await this.prisma.layerGroup.findUnique({
      where: { slug_instanceId: { slug, instanceId } },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByInstance(instanceId: string, _includeSubGroups?: boolean): Promise<LayerGroup[]> {
    const records = await this.prisma.layerGroup.findMany({
      where: { instanceId },
      orderBy: { order: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(data: Omit<LayerGroup, 'createdAt' | 'updatedAt'>): Promise<LayerGroup> {
    const record = await this.prisma.layerGroup.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        color: data.color,
        order: data.order,
        isActive: data.isActive,
        instanceId: data.instanceId,
      },
    });
    return this.toDomain(record);
  }

  async update(
    id: string,
    data: Partial<Omit<LayerGroup, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<LayerGroup> {
    const record = await this.prisma.layerGroup.update({ where: { id }, data });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.layerGroup.delete({ where: { id } });
  }

  async updateOrder(id: string, order: number): Promise<void> {
    await this.prisma.layerGroup.update({ where: { id }, data: { order } });
  }

  private toDomain(record: PrismaLayerGroup): LayerGroup {
    return new LayerGroup({
      id: record.id,
      name: record.name,
      slug: record.slug,
      description: record.description,
      icon: record.icon,
      color: record.color,
      order: record.order,
      isActive: record.isActive,
      instanceId: record.instanceId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
