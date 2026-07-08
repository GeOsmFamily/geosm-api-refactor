import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteDrawingUseCase } from '../../../../../src/application/use-cases/drawings/delete-drawing.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import type { PrismaDrawingRepository } from '../../../../../src/infrastructure/database/repositories/prisma-drawing.repository.js';

describe('DeleteDrawingUseCase', () => {
  let useCase: DeleteDrawingUseCase;
  let drawingRepository: PrismaDrawingRepository;
  const now = new Date();

  const ownedDrawing = {
    id: 'drawing-id',
    userId: 'owner-id',
    instanceId: 'instance-id',
    name: 'My drawing',
    geojson: {},
    description: null,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    drawingRepository = {
      findById: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as PrismaDrawingRepository;
    useCase = new DeleteDrawingUseCase(drawingRepository);
  });

  it('should delete the drawing when the requester is the owner', async () => {
    vi.mocked(drawingRepository.findById).mockResolvedValue(ownedDrawing);

    await useCase.execute('owner-id', 'drawing-id');

    expect(drawingRepository.delete).toHaveBeenCalledWith('drawing-id');
  });

  it('regression (IDOR): should reject deletion by a user who does not own the drawing', async () => {
    vi.mocked(drawingRepository.findById).mockResolvedValue(ownedDrawing);

    await expect(useCase.execute('someone-else-id', 'drawing-id')).rejects.toThrow(ForbiddenError);
    expect(drawingRepository.delete).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError if the drawing does not exist', async () => {
    vi.mocked(drawingRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('owner-id', 'missing-id')).rejects.toThrow(NotFoundError);
    expect(drawingRepository.delete).not.toHaveBeenCalled();
  });
});
