import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateSharedMapUseCase } from '../../../../../src/application/use-cases/sharing/create-shared-map.use-case.js';
import type { PrismaSharedMapRepository, SharedMapRecord } from '../../../../../src/infrastructure/database/repositories/prisma-shared-map.repository.js';

vi.mock('uuid', () => ({ v4: vi.fn(() => 'uuid-1') }));
vi.mock('crypto', () => ({
  default: { randomBytes: vi.fn(() => ({ toString: () => 'abcd1234' })) },
  randomBytes: vi.fn(() => ({ toString: () => 'abcd1234' })),
}));

describe('CreateSharedMapUseCase', () => {
  let useCase: CreateSharedMapUseCase;
  let sharedMapRepository: PrismaSharedMapRepository;
  const now = new Date();

  beforeEach(() => {
    sharedMapRepository = {
      create: vi.fn(),
      findByShortCode: vi.fn(),
    } as any;
    useCase = new CreateSharedMapUseCase(sharedMapRepository);
  });

  it('should create a shared map with a short code', async () => {
    const record: SharedMapRecord = {
      id: 'uuid-1',
      userId: 'user-1',
      instanceId: 'inst-1',
      mapState: { center: [11, 3], zoom: 10 },
      shortCode: 'abcd1234',
      expiresAt: null,
      createdAt: now,
    };
    vi.mocked(sharedMapRepository.create).mockResolvedValue(record);

    const result = await useCase.execute('user-1', 'inst-1', {
      mapState: { center: [11, 3], zoom: 10 },
    });

    expect(result.shortCode).toBe('abcd1234');
    expect(result.expiresAt).toBeNull();
    expect(sharedMapRepository.create).toHaveBeenCalledOnce();
  });

  it('should set expiresAt when expiresInDays is provided', async () => {
    const record: SharedMapRecord = {
      id: 'uuid-1',
      userId: 'user-1',
      instanceId: 'inst-1',
      mapState: {},
      shortCode: 'abcd1234',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
    };
    vi.mocked(sharedMapRepository.create).mockResolvedValue(record);

    await useCase.execute('user-1', 'inst-1', {
      mapState: {},
      expiresInDays: 7,
    });

    expect(sharedMapRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: expect.any(Date),
      }),
    );
  });
});
