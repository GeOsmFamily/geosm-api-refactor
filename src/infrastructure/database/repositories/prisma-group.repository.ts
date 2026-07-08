import { PrismaClient, Group as PrismaGroup } from '@prisma/client';
import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { Group } from '../../../domain/entities/group.entity.js';

export class PrismaGroupRepository implements IGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Group | null> {
    const record = await this.prisma.group.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findBySlug(slug: string, instanceId: string): Promise<Group | null> {
    const record = await this.prisma.group.findUnique({
      where: { slug_instanceId: { slug, instanceId } },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByInstance(instanceId: string, _includeSubGroups?: boolean): Promise<Group[]> {
    const records = await this.prisma.group.findMany({
      where: { instanceId },
      orderBy: { order: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(data: Omit<Group, 'createdAt' | 'updatedAt'>): Promise<Group> {
    const record = await this.prisma.group.create({
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
    data: Partial<Omit<Group, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Group> {
    const record = await this.prisma.group.update({ where: { id }, data });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.group.delete({ where: { id } });
  }

  async updateOrder(id: string, order: number): Promise<void> {
    await this.prisma.group.update({ where: { id }, data: { order } });
  }

  private toDomain(record: PrismaGroup): Group {
    return new Group({
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
