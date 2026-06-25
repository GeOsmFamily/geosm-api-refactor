import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackEventUseCase } from '../../../../../src/application/use-cases/analytics/track-event.use-case.js';
import type { PrismaAnalyticsRepository, AnalyticsEventRecord } from '../../../../../src/infrastructure/database/repositories/prisma-analytics.repository.js';

vi.mock('uuid', () => ({ v4: vi.fn(() => 'uuid-1') }));

describe('TrackEventUseCase', () => {
  let useCase: TrackEventUseCase;
  let analyticsRepository: PrismaAnalyticsRepository;
  const now = new Date();

  beforeEach(() => {
    analyticsRepository = {
      create: vi.fn(),
      getAggregatedStats: vi.fn(),
    } as any;
    useCase = new TrackEventUseCase(analyticsRepository);
  });

  it('should create an analytics event record', async () => {
    const record: AnalyticsEventRecord = {
      id: 'uuid-1',
      eventType: 'DOWNLOAD',
      userId: 'user-1',
      instanceId: 'inst-1',
      layerId: 'layer-1',
      metadata: null,
      ipAddress: '1.2.3.4',
      createdAt: now,
    };
    vi.mocked(analyticsRepository.create).mockResolvedValue(record);

    const result = await useCase.execute('inst-1', {
      eventType: 'DOWNLOAD',
      userId: 'user-1',
      layerId: 'layer-1',
      ipAddress: '1.2.3.4',
    });

    expect(result.eventType).toBe('DOWNLOAD');
    expect(result.instanceId).toBe('inst-1');
    expect(analyticsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'uuid-1',
        eventType: 'DOWNLOAD',
        instanceId: 'inst-1',
      }),
    );
  });
});
