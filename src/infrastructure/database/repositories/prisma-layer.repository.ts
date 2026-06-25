import { PrismaClient, Layer as PrismaLayer, Prisma } from '@prisma/client';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../domain/enums.js';

export class PrismaLayerRepository implements ILayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Layer | null> {
    const record = await this.prisma.layer.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findBySlug(slug: string, instanceId: string): Promise<Layer | null> {
    const record = await this.prisma.layer.findUnique({ where: { slug_instanceId: { slug, instanceId } } });
    return record ? this.toDomain(record) : null;
  }

  async findBySubGroup(subGroupId: string): Promise<Layer[]> {
    const records = await this.prisma.layer.findMany({ where: { subGroupId }, orderBy: { order: 'asc' } });
    return records.map(r => this.toDomain(r));
  }

  async findByInstance(instanceId: string, options?: { page?: number; limit?: number; search?: string; geometryType?: GeometryType; subGroupId?: string }): Promise<{ data: Layer[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LayerWhereInput = { instanceId };
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { slug: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (options?.geometryType) where.geometryType = options.geometryType;
    if (options?.subGroupId) where.subGroupId = options.subGroupId;

    const [records, total] = await Promise.all([
      this.prisma.layer.findMany({ where, skip, take: limit, orderBy: { order: 'asc' } }),
      this.prisma.layer.count({ where }),
    ]);

    return { data: records.map(r => this.toDomain(r)), total };
  }

  async create(data: Omit<Layer, 'createdAt' | 'updatedAt'>): Promise<Layer> {
    const record = await this.prisma.layer.create({
      data: {
        id: data.id, name: data.name, slug: data.slug, description: data.description,
        geometryType: data.geometryType, sourceType: data.sourceType,
        sourceUrl: data.sourceUrl, sourceLayer: data.sourceLayer,
        tableName: data.tableName, schemaName: data.schemaName,
        minZoom: data.minZoom, maxZoom: data.maxZoom,
        isVisible: data.isVisible, isQueryable: data.isQueryable,
        opacity: data.opacity, order: data.order,
        metadata: data.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
        subGroupId: data.subGroupId, instanceId: data.instanceId,
        qgisProjectId: data.qgisProjectId,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: Partial<Omit<Layer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Layer> {
    const updateData: Prisma.LayerUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sourceUrl !== undefined) updateData.sourceUrl = data.sourceUrl;
    if (data.sourceLayer !== undefined) updateData.sourceLayer = data.sourceLayer;
    if (data.tableName !== undefined) updateData.tableName = data.tableName;
    if (data.schemaName !== undefined) updateData.schemaName = data.schemaName;
    if (data.minZoom !== undefined) updateData.minZoom = data.minZoom;
    if (data.maxZoom !== undefined) updateData.maxZoom = data.maxZoom;
    if (data.isVisible !== undefined) updateData.isVisible = data.isVisible;
    if (data.isQueryable !== undefined) updateData.isQueryable = data.isQueryable;
    if (data.opacity !== undefined) updateData.opacity = data.opacity;
    if (data.order !== undefined) updateData.order = data.order;
    if ('metadata' in data) updateData.metadata = data.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull;
    const record = await this.prisma.layer.update({ where: { id }, data: updateData });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.layer.delete({ where: { id } });
  }

  private toDomain(record: PrismaLayer): Layer {
    return new Layer({
      id: record.id, name: record.name, slug: record.slug, description: record.description,
      geometryType: record.geometryType as GeometryType, sourceType: record.sourceType as SourceType,
      sourceUrl: record.sourceUrl, sourceLayer: record.sourceLayer,
      tableName: record.tableName, schemaName: record.schemaName,
      minZoom: record.minZoom, maxZoom: record.maxZoom,
      isVisible: record.isVisible, isQueryable: record.isQueryable,
      opacity: record.opacity, order: record.order,
      metadata: record.metadata as Record<string, unknown> | null,
      subGroupId: record.subGroupId, instanceId: record.instanceId,
      qgisProjectId: record.qgisProjectId, createdAt: record.createdAt, updatedAt: record.updatedAt,
    });
  }
}
