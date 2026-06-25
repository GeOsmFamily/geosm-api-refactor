import { PrismaClient, LayerStyle as PrismaLayerStyle, Prisma } from '@prisma/client';
import { ILayerStyleRepository } from '../../../domain/repositories/layer-style.repository.js';
import { LayerStyle } from '../../../domain/entities/layer-style.entity.js';

export class PrismaLayerStyleRepository implements ILayerStyleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByLayerId(layerId: string): Promise<LayerStyle[]> {
    const records = await this.prisma.layerStyle.findMany({ where: { layerId }, orderBy: { createdAt: 'asc' } });
    return records.map(r => this.toDomain(r));
  }

  async findById(id: string): Promise<LayerStyle | null> {
    const record = await this.prisma.layerStyle.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async create(data: Omit<LayerStyle, 'createdAt' | 'updatedAt'>): Promise<LayerStyle> {
    const record = await this.prisma.layerStyle.create({
      data: {
        id: data.id,
        name: data.name,
        sldBody: data.sldBody,
        mapboxStyle: data.mapboxStyle as Prisma.InputJsonValue ?? Prisma.JsonNull,
        isDefault: data.isDefault,
        layerId: data.layerId,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: Partial<Omit<LayerStyle, 'id' | 'createdAt' | 'updatedAt'>>): Promise<LayerStyle> {
    const updateData: Prisma.LayerStyleUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sldBody !== undefined) updateData.sldBody = data.sldBody;
    if ('mapboxStyle' in data) updateData.mapboxStyle = data.mapboxStyle as Prisma.InputJsonValue ?? Prisma.JsonNull;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    const record = await this.prisma.layerStyle.update({ where: { id }, data: updateData });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.layerStyle.delete({ where: { id } });
  }

  private toDomain(record: PrismaLayerStyle): LayerStyle {
    return new LayerStyle({
      id: record.id,
      name: record.name,
      sldBody: record.sldBody,
      mapboxStyle: record.mapboxStyle as Record<string, unknown> | null,
      isDefault: record.isDefault,
      layerId: record.layerId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
