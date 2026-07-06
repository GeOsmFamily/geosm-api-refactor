import { PrismaDrawingRepository, DrawingRecord } from '../../../infrastructure/database/repositories/prisma-drawing.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetDrawingsUseCase');

export class GetDrawingsUseCase {
  constructor(private readonly drawingRepository: PrismaDrawingRepository) {}

  async execute(userId: string, instanceId: string): Promise<DrawingRecord[]> {
    logger.debug('Listing drawings', { userId, instanceId });
    return this.drawingRepository.findByUserId(userId, instanceId);
  }
}
