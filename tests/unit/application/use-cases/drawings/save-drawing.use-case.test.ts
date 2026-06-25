import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveDrawingUseCase } from '../../../../../src/application/use-cases/drawings/save-drawing.use-case.js';
import type { PrismaDrawingRepository, DrawingRecord } from '../../../../../src/infrastructure/database/repositories/prisma-drawing.repository.js';

vi.mock('uuid', () => ({ v4: vi.fn(() => 'uuid-1') }));

describe('SaveDrawingUseCase', () => {
  let useCase: SaveDrawingUseCase;
  let drawingRepository: PrismaDrawingRepository;
  const now = new Date();

  beforeEach(() => {
    drawingRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as any;
    useCase = new SaveDrawingUseCase(drawingRepository);
  });

  it('should create a drawing and return the record', async () => {
    const record: DrawingRecord = {
      id: 'uuid-1',
      userId: 'user-1',
      instanceId: 'inst-1',
      name: 'My Drawing',
      geojson: { type: 'FeatureCollection', features: [] },
      description: null,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    };
    vi.mocked(drawingRepository.create).mockResolvedValue(record);

    const result = await useCase.execute('user-1', 'inst-1', {
      name: 'My Drawing',
      geojson: { type: 'FeatureCollection', features: [] },
    });

    expect(result.id).toBe('uuid-1');
    expect(result.name).toBe('My Drawing');
    expect(drawingRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'uuid-1',
        userId: 'user-1',
        instanceId: 'inst-1',
        name: 'My Drawing',
        isPublic: false,
      }),
    );
  });
});
