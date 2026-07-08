import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmitFeedbackUseCase } from '../../../../../src/application/use-cases/feedback/submit-feedback.use-case.js';
import type { PrismaFeedbackRepository } from '../../../../../src/infrastructure/database/repositories/prisma-feedback.repository.js';
import type { AlertingService } from '../../../../../src/infrastructure/observability/alerting.service.js';

describe('SubmitFeedbackUseCase', () => {
  let useCase: SubmitFeedbackUseCase;
  let feedbackRepository: PrismaFeedbackRepository;
  let alertingService: AlertingService;
  const now = new Date();

  beforeEach(() => {
    feedbackRepository = {
      create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, createdAt: now })),
    } as unknown as PrismaFeedbackRepository;
    alertingService = {
      sendAlert: vi.fn().mockResolvedValue(undefined),
    } as unknown as AlertingService;
    useCase = new SubmitFeedbackUseCase(feedbackRepository, alertingService);
  });

  it('should store feedback and notify via Slack for an anonymous submission', async () => {
    const result = await useCase.execute(
      { type: 'BUG' as never, description: 'Map does not load' },
      undefined,
    );

    expect(feedbackRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'BUG', description: 'Map does not load', userId: null, contactEmail: null, page: null }),
    );
    expect(alertingService.sendAlert).toHaveBeenCalledWith(
      'WARNING',
      expect.stringContaining('BUG'),
      'Map does not load',
      expect.objectContaining({ userId: undefined }),
    );
    expect(result.userId).toBeNull();
  });

  it('should attribute feedback to the authenticated user when present', async () => {
    await useCase.execute(
      { type: 'SUGGESTION' as never, description: 'Add dark mode', contactEmail: 'user@example.com' },
      'user-id',
    );

    expect(feedbackRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-id', contactEmail: 'user@example.com' }),
    );
  });
});
