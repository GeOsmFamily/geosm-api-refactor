import { PrismaClient, LocationPlan as PrismaLocationPlan } from '@prisma/client';
import { ILocationPlanRepository } from '../../../domain/repositories/location-plan.repository.js';
import { LocationPlan } from '../../../domain/entities/location-plan.entity.js';
import { JobStatus, PaperSize, PlanOrientation } from '../../../domain/enums.js';

export class PrismaLocationPlanRepository implements ILocationPlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<LocationPlan | null> {
    const record = await this.prisma.locationPlan.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async create(data: Omit<LocationPlan, 'createdAt' | 'updatedAt'>): Promise<LocationPlan> {
    const record = await this.prisma.locationPlan.create({
      data: {
        id: data.id,
        userId: data.userId,
        instanceId: data.instanceId,
        status: data.status,
        title: data.title,
        description: data.description,
        landmark: data.landmark,
        lon: data.lon,
        lat: data.lat,
        scale: data.scale,
        paperSize: data.paperSize,
        orientation: data.orientation,
        includeLegend: data.includeLegend,
        includeScale: data.includeScale,
        includeGrid: data.includeGrid,
        includeNorthArrow: data.includeNorthArrow,
        filePath: data.filePath,
        fileSize: data.fileSize,
        errorMessage: data.errorMessage,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: Partial<Omit<LocationPlan, 'id' | 'createdAt' | 'updatedAt'>>): Promise<LocationPlan> {
    const record = await this.prisma.locationPlan.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.filePath !== undefined && { filePath: data.filePath }),
        ...(data.fileSize !== undefined && { fileSize: data.fileSize }),
        ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
        ...(data.startedAt !== undefined && { startedAt: data.startedAt }),
        ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
      },
    });
    return this.toDomain(record);
  }

  private toDomain(record: PrismaLocationPlan): LocationPlan {
    return new LocationPlan({
      id: record.id,
      userId: record.userId,
      instanceId: record.instanceId,
      status: record.status as JobStatus,
      title: record.title,
      description: record.description,
      landmark: record.landmark,
      lon: record.lon,
      lat: record.lat,
      scale: record.scale,
      paperSize: record.paperSize as PaperSize,
      orientation: record.orientation as PlanOrientation,
      includeLegend: record.includeLegend,
      includeScale: record.includeScale,
      includeGrid: record.includeGrid,
      includeNorthArrow: record.includeNorthArrow,
      filePath: record.filePath,
      fileSize: record.fileSize,
      errorMessage: record.errorMessage,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
