import { PrismaFeedbackRepository, FeedbackRecord, AdminListFeedbackOptions } from '../../../infrastructure/database/repositories/prisma-feedback.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('AdminListFeedbackUseCase');

export class AdminListFeedbackUseCase {
  constructor(private readonly feedbackRepository: PrismaFeedbackRepository) {}

  async execute(options: AdminListFeedbackOptions): Promise<{ data: FeedbackRecord[]; total: number }> {
    logger.debug('Admin listing feedback', options);
    return this.feedbackRepository.adminList(options);
  }
}
