import { PrismaClient, Instance as PrismaInstance, InstanceUser as PrismaInstanceUser, Prisma } from '@prisma/client';
import { IInstanceRepository, InstanceUserRecord } from '../../../domain/repositories/instance.repository.js';
import { Instance } from '../../../domain/entities/instance.entity.js';
import { Role } from '../../../domain/enums.js';

export class PrismaInstanceRepository implements IInstanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Instance | null> {
    const record = await this.prisma.instance.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findBySlug(slug: string): Promise<Instance | null> {
    const record = await this.prisma.instance.findUnique({ where: { slug } });
    return record ? this.toDomain(record) : null;
  }

  async findAll(options?: { page?: number; limit?: number; search?: string; isActive?: boolean }): Promise<{ data: Instance[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InstanceWhereInput = {};
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { slug: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (options?.isActive !== undefined) where.isActive = options.isActive;

    const [records, total] = await Promise.all([
      this.prisma.instance.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.instance.count({ where }),
    ]);

    return { data: records.map(r => this.toDomain(r)), total };
  }

  async create(data: Omit<Instance, 'createdAt' | 'updatedAt'>): Promise<Instance> {
    const record = await this.prisma.instance.create({
      data: {
        id: data.id, name: data.name, slug: data.slug, description: data.description,
        logo: data.logo, bbox: data.bbox ?? [], centerLat: data.centerLat, centerLon: data.centerLon,
        defaultZoom: data.defaultZoom, isActive: data.isActive,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: Partial<Omit<Instance, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Instance> {
    const updateData: Prisma.InstanceUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.bbox !== undefined) updateData.bbox = data.bbox ?? [];
    if (data.centerLat !== undefined) updateData.centerLat = data.centerLat;
    if (data.centerLon !== undefined) updateData.centerLon = data.centerLon;
    if (data.defaultZoom !== undefined) updateData.defaultZoom = data.defaultZoom;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    const record = await this.prisma.instance.update({ where: { id }, data: updateData });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.instance.delete({ where: { id } });
  }

  async findInstanceUsers(instanceId: string): Promise<InstanceUserRecord[]> {
    const records = await this.prisma.instanceUser.findMany({
      where: { instanceId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    return records.map(r => this.toInstanceUserRecord(r));
  }

  async addInstanceUser(instanceId: string, userId: string, role: Role): Promise<InstanceUserRecord> {
    const record = await this.prisma.instanceUser.create({
      data: { instanceId, userId, role },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    return this.toInstanceUserRecord(record);
  }

  async removeInstanceUser(instanceId: string, userId: string): Promise<void> {
    await this.prisma.instanceUser.delete({
      where: { userId_instanceId: { userId, instanceId } },
    });
  }

  async changeInstanceUserRole(instanceId: string, userId: string, role: Role): Promise<InstanceUserRecord> {
    const record = await this.prisma.instanceUser.update({
      where: { userId_instanceId: { userId, instanceId } },
      data: { role },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    return this.toInstanceUserRecord(record);
  }

  async findInstanceUser(instanceId: string, userId: string): Promise<InstanceUserRecord | null> {
    const record = await this.prisma.instanceUser.findUnique({
      where: { userId_instanceId: { userId, instanceId } },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    return record ? this.toInstanceUserRecord(record) : null;
  }

  private toDomain(record: PrismaInstance): Instance {
    return new Instance({
      id: record.id, name: record.name, slug: record.slug, description: record.description,
      logo: record.logo, bbox: record.bbox, centerLat: record.centerLat, centerLon: record.centerLon,
      defaultZoom: record.defaultZoom,
      boundaryTable: (record as Record<string, unknown>).boundaryTable as string | null ?? null,
      boundaryId: (record as Record<string, unknown>).boundaryId as number | null ?? null,
      boundaryGeomCol: (record as Record<string, unknown>).boundaryGeomCol as string | null ?? null,
      adminLevel: (record as Record<string, unknown>).adminLevel as number | null ?? null,
      parentInstanceId: (record as Record<string, unknown>).parentInstanceId as string | null ?? null,
      isActive: record.isActive,
      createdAt: record.createdAt, updatedAt: record.updatedAt,
    });
  }

  private toInstanceUserRecord(record: PrismaInstanceUser & { user?: { id: string; email: string; firstName: string; lastName: string } }): InstanceUserRecord {
    return {
      id: record.id, userId: record.userId, instanceId: record.instanceId,
      role: record.role as Role, user: record.user,
      createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }
}
