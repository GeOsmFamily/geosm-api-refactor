import { PrismaAnalyticsRepository, AnalyticsAggregation } from '../../../infrastructure/database/repositories/prisma-analytics.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetAnalyticsUseCase');

export class GetAnalyticsUseCase {
  constructor(private readonly analyticsRepository: PrismaAnalyticsRepository) {}

  async execute(instanceId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsAggregation[]> {
    logger.debug('Getting analytics aggregation', { instanceId, startDate, endDate });
    return this.analyticsRepository.getAggregatedStats(instanceId, startDate, endDate);
  }
}
