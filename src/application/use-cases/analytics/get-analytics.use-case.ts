import { PrismaAnalyticsRepository, AnalyticsAggregation } from '../../../infrastructure/database/repositories/prisma-analytics.repository.js';

export class GetAnalyticsUseCase {
  constructor(private readonly analyticsRepository: PrismaAnalyticsRepository) {}

  async execute(instanceId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsAggregation[]> {
    return this.analyticsRepository.getAggregatedStats(instanceId, startDate, endDate);
  }
}
