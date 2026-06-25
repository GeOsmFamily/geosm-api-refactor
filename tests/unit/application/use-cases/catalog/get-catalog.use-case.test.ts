import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetCatalogUseCase } from '../../../../../src/application/use-cases/catalog/get-catalog.use-case.js';

describe('GetCatalogUseCase', () => {
  let useCase: GetCatalogUseCase;
  let prisma: { instance: { findMany: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    prisma = {
      instance: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    useCase = new GetCatalogUseCase(prisma as any);
  });

  it('should return catalog structure', async () => {
    prisma.instance.findMany.mockResolvedValue([
      {
        id: 'inst-1', name: 'Test Instance', slug: 'test', description: null, logo: null,
        groups: [{
          id: 'g-1', name: 'Group 1', slug: 'group-1', description: null, icon: null, color: null,
          subGroups: [{
            id: 'sg-1', name: 'Sub Group 1', slug: 'sub-1', description: null,
            layers: [{ id: 'l-1', name: 'Layer 1', slug: 'layer-1', description: null, geometryType: 'POINT', sourceType: 'WFS' }],
          }],
        }],
      },
    ]);

    const result = await useCase.execute();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('test');
    expect(result[0].groups[0].subGroups[0].layers).toHaveLength(1);
  });

  it('should filter by instanceSlug', async () => {
    prisma.instance.findMany.mockResolvedValue([]);

    await useCase.execute('my-instance');
    expect(prisma.instance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: 'my-instance' }),
      }),
    );
  });
});
