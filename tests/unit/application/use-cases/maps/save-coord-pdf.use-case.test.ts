import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveCoordPdfUseCase } from '../../../../../src/application/use-cases/maps/save-coord-pdf.use-case.js';

describe('SaveCoordPdfUseCase', () => {
  let useCase: SaveCoordPdfUseCase;
  let prisma: { $queryRawUnsafe: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = { $queryRawUnsafe: vi.fn() };
    useCase = new SaveCoordPdfUseCase(prisma as any);
  });

  it('should save coord pdf and return id with coordinates', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'pdf-1' }]);

    const input = {
      instanceId: 'inst-1',
      coordinates: [{ lat: 1, lon: 2 }],
      title: 'My Title',
      description: 'Desc',
      userId: 'user-1',
    };

    const result = await useCase.execute(input);
    expect(result).toEqual({ id: 'pdf-1', coordinates: input.coordinates });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO'),
      'inst-1',
      JSON.stringify(input.coordinates),
      'My Title',
      'Desc',
      'user-1',
    );
  });

  it('should default title and description to empty strings', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'pdf-2' }]);

    await useCase.execute({
      instanceId: 'inst-1',
      coordinates: [],
      userId: 'user-1',
    });

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      'inst-1',
      '[]',
      '',
      '',
      'user-1',
    );
  });

  it('should handle empty query result', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    const result = await useCase.execute({
      instanceId: 'inst-1',
      coordinates: [],
      userId: 'user-1',
    });

    expect(result.id).toBeUndefined();
  });
});
