import { FeedbackStatus } from '@prisma/client';
import { PrismaFeedbackRepository, FeedbackRecord } from '../../../infrastructure/database/repositories/prisma-feedback.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateFeedbackStatusUseCase');

export class UpdateFeedbackStatusUseCase {
  constructor(private readonly feedbackRepository: PrismaFeedbackRepository) {}

  async execute(id: string, status: FeedbackStatus, adminNotes?: string): Promise<FeedbackRecord> {
    const feedback = await this.feedbackRepository.findById(id);
    if (!feedback) throw new NotFoundError('FeedbackSubmission', id);

    logger.info('Feedback status updated', { feedbackId: id, status });
    return this.feedbackRepository.updateStatus(id, status, adminNotes ?? null);
  }
}
