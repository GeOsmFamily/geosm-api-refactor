import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateMapCompositionUseCase } from '../../../../../src/application/use-cases/maps/create-map-composition.use-case.js';

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('CreateMapCompositionUseCase', () => {
  let useCase: CreateMapCompositionUseCase;
  let repository: { create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { create: vi.fn() };
    useCase = new CreateMapCompositionUseCase(repository as any);
  });

  it('should create a map composition with defaults', async () => {
    const expected = { id: 'mock-uuid', name: 'Test Map', slug: 'test-map' };
    repository.create.mockResolvedValue(expected);

    const result = await useCase.execute('user-1', 'instance-1', {
      name: 'Test Map',
      slug: 'test-map',
      layers: [{ id: 'layer-1' }],
      center: [0, 0],
    });

    expect(result).toEqual(expected);
    expect(repository.create).toHaveBeenCalledWith({
      id: 'mock-uuid',
      name: 'Test Map',
      slug: 'test-map',
      description: null,
      instanceId: 'instance-1',
      layers: [{ id: 'layer-1' }],
      center: [0, 0],
      zoom: 6,
      isPublic: false,
      userId: 'user-1',
    });
  });

  it('should use provided optional values', async () => {
    repository.create.mockResolvedValue({});

    await useCase.execute('user-1', 'instance-1', {
      name: 'Map',
      slug: 'map',
      layers: [],
      center: [1, 2],
      description: 'A description',
      zoom: 10,
      isPublic: true,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'A description',
        zoom: 10,
        isPublic: true,
      }),
    );
  });

  it('should propagate repository errors', async () => {
    repository.create.mockRejectedValue(new Error('DB error'));
    await expect(
      useCase.execute('u', 'i', { name: 'x', slug: 'x', layers: [], center: [] }),
    ).rejects.toThrow('DB error');
  });
});
