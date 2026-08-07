import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetStaleLayersUseCase } from '../../../../../src/application/use-cases/admin/get-stale-layers.use-case.js';

describe('GetStaleLayersUseCase', () => {
  let prisma: { layer: { findMany: ReturnType<typeof vi.fn> } };
  let useCase: GetStaleLayersUseCase;

  beforeEach(() => {
    prisma = { layer: { findMany: vi.fn(async () => []) } };
    useCase = new GetStaleLayersUseCase(prisma as any);
  });

  it('queries layers older than the cutoff and applies the default cutoff of 90 days', async () => {
    await useCase.execute();
    const call = prisma.layer.findMany.mock.calls[0][0];
    const cutoff: Date = call.where.updatedAt.lt;
    const expectedCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
  });

  it('localizes layer and instance names and computes days-since-update', async () => {
    const updatedAt = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    prisma.layer.findMany.mockResolvedValueOnce([
      {
        id: 'layer-1',
        name: '{"fr":"Hôpitaux","en":"Hospitals"}',
        updatedAt,
        instance: { id: 'instance-1', name: '{"fr":"Cameroun","en":"Cameroon"}' },
      },
    ]);
    const result = await useCase.execute(90, 'en');
    expect(result).toEqual([
      {
        id: 'layer-1',
        name: 'Hospitals',
        instanceId: 'instance-1',
        instanceName: 'Cameroon',
        updatedAt,
        daysSinceUpdate: 120,
      },
    ]);
  });
});
