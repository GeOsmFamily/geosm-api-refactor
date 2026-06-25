import { v4 as uuidv4 } from 'uuid';
import { PrismaAnalyticsRepository, AnalyticsEventRecord } from '../../../infrastructure/database/repositories/prisma-analytics.repository.js';

export class IncrementViewUseCase {
  constructor(private readonly analyticsRepository: PrismaAnalyticsRepository) {}

  async execute(type: 'layer' | 'instance', id: string, ipAddress?: string, userId?: string): Promise<AnalyticsEventRecord> {
    const eventType = type === 'layer' ? 'layer_view' : 'instance_view';
    const instanceId = type === 'instance' ? id : undefined;
    const layerId = type === 'layer' ? id : undefined;

    return this.analyticsRepository.create({
      id: uuidv4(),
      eventType,
      userId: userId ?? null,
      instanceId: instanceId ?? id,
      layerId: layerId ?? null,
      metadata: { viewedAt: new Date().toISOString() },
      ipAddress: ipAddress ?? null,
    });
  }
}
