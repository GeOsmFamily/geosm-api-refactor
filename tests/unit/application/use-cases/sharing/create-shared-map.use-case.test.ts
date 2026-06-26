import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateSharedMapUseCase } from '../../../../../src/application/use-cases/sharing/create-shared-map.use-case.js';

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
vi.mock('crypto', () => ({
  default: { randomBytes: () => ({ toString: () => 'abcd1234' }) },
  randomBytes: () => ({ toString: () => 'abcd1234' }),
}));

describe('CreateSharedMapUseCase', () => {
  let useCase: CreateSharedMapUseCase;
  let repository: { create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { create: vi.fn() };
    useCase = new CreateSharedMapUseCase(repository as any);
  });

  it('should create a shared map without expiration', async () => {
    const record = { id: 'mock-uuid', shortCode: 'abcd1234' };
    repository.create.mockResolvedValue(record);

    const result = await useCase.execute('user-1', 'inst-1', { mapState: { layers: [] } });

    expect(result).toEqual(record);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-uuid',
        userId: 'user-1',
        instanceId: 'inst-1',
        shortCode: 'abcd1234',
        expiresAt: null,
      }),
    );
  });

  it('should create a shared map with expiration', async () => {
    repository.create.mockResolvedValue({});
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await useCase.execute('user-1', 'inst-1', { mapState: {}, expiresInDays: 7 });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
      }),
    );

    vi.restoreAllMocks();
  });

  it('should propagate repository errors', async () => {
    repository.create.mockRejectedValue(new Error('DB error'));
    await expect(
      useCase.execute('u', 'i', { mapState: {} }),
    ).rejects.toThrow('DB error');
  });
});
