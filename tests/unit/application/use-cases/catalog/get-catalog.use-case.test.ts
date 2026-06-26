import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetCatalogUseCase } from '../../../../../src/application/use-cases/catalog/get-catalog.use-case.js';

describe('GetCatalogUseCase', () => {
  let useCase: GetCatalogUseCase;
  let prisma: { instance: { findMany: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    prisma = { instance: { findMany: vi.fn() } };
    useCase = new GetCatalogUseCase(prisma as any);
  });

  it('should return catalog for all instances', async () => {
    prisma.instance.findMany.mockResolvedValue([
      {
        id: 'i1', name: 'Instance 1', slug: 'inst-1', description: null, logo: null,
        groups: [{
          id: 'g1', name: 'Group', slug: 'group', description: null, icon: null, color: null,
          subGroups: [{
            id: 'sg1', name: 'Sub', slug: 'sub', description: null,
            layers: [{ id: 'l1', name: 'Layer', slug: 'layer', description: null, geometryType: 'Point', sourceType: 'vector' }],
          }],
        }],
      },
    ]);

    const result = await useCase.execute();

    expect(result).toHaveLength(1);
    expect(result[0].groups[0].subGroups[0].layers).toHaveLength(1);
    expect(prisma.instance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('should filter by instance slug when provided', async () => {
    prisma.instance.findMany.mockResolvedValue([]);

    await useCase.execute('my-slug');

    expect(prisma.instance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, slug: 'my-slug' } }),
    );
  });

  it('should return empty array when no instances found', async () => {
    prisma.instance.findMany.mockResolvedValue([]);
    const result = await useCase.execute();
    expect(result).toEqual([]);
  });
});
