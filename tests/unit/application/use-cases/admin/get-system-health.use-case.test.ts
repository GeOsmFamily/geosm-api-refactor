import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSystemHealthUseCase } from '../../../../../src/application/use-cases/admin/get-system-health.use-case.js';

describe('GetSystemHealthUseCase', () => {
  let useCase: GetSystemHealthUseCase;
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let redisService: { getClient: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = { $queryRaw: vi.fn() };
    redisService = { getClient: vi.fn() };
    useCase = new GetSystemHealthUseCase(prisma as any, redisService as any);
  });

  it('should return up when both services are healthy', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redisService.getClient.mockReturnValue({ ping: vi.fn().mockResolvedValue('PONG') });
    const result = await useCase.execute();
    expect(result).toEqual({ database: 'up', redis: 'up' });
  });

  it('should return down when database fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection failed'));
    redisService.getClient.mockReturnValue({ ping: vi.fn().mockResolvedValue('PONG') });
    const result = await useCase.execute();
    expect(result.database).toBe('down');
    expect(result.redis).toBe('up');
  });

  it('should return down when redis fails', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redisService.getClient.mockReturnValue({ ping: vi.fn().mockRejectedValue(new Error('fail')) });
    const result = await useCase.execute();
    expect(result.database).toBe('up');
    expect(result.redis).toBe('down');
  });
});
