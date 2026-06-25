import { PrismaClient, BaseMap as PrismaBaseMap, Prisma } from '@prisma/client';
import { IBaseMapRepository } from '../../../domain/repositories/base-map.repository.js';
import { BaseMap } from '../../../domain/entities/base-map.entity.js';
import { BaseMapType } from '../../../domain/enums.js';

export class PrismaBaseMapRepository implements IBaseMapRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<BaseMap | null> {
    const record = await this.prisma.baseMap.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByInstance(instanceId: string): Promise<BaseMap[]> {
    const records = await this.prisma.baseMap.findMany({ where: { instanceId }, orderBy: { order: 'asc' } });
    return records.map(r => this.toDomain(r));
  }

  async findDefaults(): Promise<BaseMap[]> {
    const records = await this.prisma.baseMap.findMany({ where: { isDefault: true }, orderBy: { order: 'asc' } });
    return records.map(r => this.toDomain(r));
  }

  async create(data: Omit<BaseMap, 'createdAt' | 'updatedAt'>): Promise<BaseMap> {
    const record = await this.prisma.baseMap.create({
      data: {
        id: data.id, name: data.name, slug: data.slug, type: data.type,
        url: data.url, thumbnail: data.thumbnail, attribution: data.attribution,
        isDefault: data.isDefault, order: data.order,
        config: data.config as Prisma.InputJsonValue ?? Prisma.JsonNull,
        instanceId: data.instanceId,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: Partial<Omit<BaseMap, 'id' | 'createdAt' | 'updatedAt'>>): Promise<BaseMap> {
    const updateData: Prisma.BaseMapUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail;
    if (data.attribution !== undefined) updateData.attribution = data.attribution;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.order !== undefined) updateData.order = data.order;
    if ('config' in data) updateData.config = data.config as Prisma.InputJsonValue ?? Prisma.JsonNull;
    const record = await this.prisma.baseMap.update({ where: { id }, data: updateData });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.baseMap.delete({ where: { id } });
  }

  private toDomain(record: PrismaBaseMap): BaseMap {
    return new BaseMap({
      id: record.id, name: record.name, slug: record.slug,
      type: record.type as BaseMapType, url: record.url,
      thumbnail: record.thumbnail, attribution: record.attribution,
      isDefault: record.isDefault, order: record.order,
      config: record.config as Record<string, unknown> | null,
      instanceId: record.instanceId, createdAt: record.createdAt, updatedAt: record.updatedAt,
    });
  }
}
