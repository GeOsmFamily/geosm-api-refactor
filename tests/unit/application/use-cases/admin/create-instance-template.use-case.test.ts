import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateInstanceTemplateUseCase } from '../../../../../src/application/use-cases/admin/create-instance-template.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';

describe('CreateInstanceTemplateUseCase', () => {
  let useCase: CreateInstanceTemplateUseCase;
  let instanceRepository: IInstanceRepository;
  let prisma: { $executeRawUnsafe: ReturnType<typeof vi.fn> };
  const now = new Date();

  const mockInstance = new Instance({
    id: 'inst-1', name: 'Test', slug: 'test', description: null, logo: null,
    bbox: null, centerLat: null, centerLon: null, defaultZoom: 6, isActive: true,
    createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(),
      create: vi.fn().mockResolvedValue(mockInstance),
      update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(),
      changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    prisma = { $executeRawUnsafe: vi.fn().mockResolvedValue(undefined) };
    useCase = new CreateInstanceTemplateUseCase(instanceRepository, prisma as any);
  });

  it('should create instance with default thematiques', async () => {
    const result = await useCase.execute({ name: 'Test', slug: 'test' });
    expect(result).toBe(mockInstance);
    expect(instanceRepository.create).toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(4);
  });

  it('should create instance with custom thematiques', async () => {
    const result = await useCase.execute({ name: 'Test', slug: 'test', thematiques: ['A', 'B'] });
    expect(result).toBe(mockInstance);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });
});
