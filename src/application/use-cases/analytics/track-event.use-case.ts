import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaAnalyticsRepository, AnalyticsEventRecord } from '../../../infrastructure/database/repositories/prisma-analytics.repository.js';

export interface TrackEventDTO {
  eventType: string;
  userId?: string;
  layerId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

export class TrackEventUseCase {
  constructor(private readonly analyticsRepository: PrismaAnalyticsRepository) {}

  async execute(instanceId: string, dto: TrackEventDTO): Promise<AnalyticsEventRecord> {
    return this.analyticsRepository.create({
      id: uuidv4(),
      eventType: dto.eventType,
      userId: dto.userId ?? null,
      instanceId,
      layerId: dto.layerId ?? null,
      metadata: dto.metadata ?? null,
      ipAddress: dto.ipAddress ?? null,
    });
  }
}
