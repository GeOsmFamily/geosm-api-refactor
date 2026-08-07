import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateInstanceTemplateUseCase } from '../../../../../src/application/use-cases/admin/create-instance-template.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';

describe('CreateInstanceTemplateUseCase', () => {
  let useCase: CreateInstanceTemplateUseCase;
  let instanceRepository: IInstanceRepository;
  let prisma: { group: { create: ReturnType<typeof vi.fn> } };
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
    // Anciennement une insertion SQL brute vers une table "Group" inexistante (bug corrigé,
    // voir plan "Interopérabilité & sécurité des données" du 2026-08-06) - remplacée par de
    // vrais appels Prisma Client, donc ce test mocke maintenant prisma.group.create() plutôt
    // que $executeRawUnsafe (qui aurait masqué le bug initial sans jamais l'exercer réellement).
    prisma = { group: { create: vi.fn().mockResolvedValue({ id: 'group-1' }) } };
    useCase = new CreateInstanceTemplateUseCase(instanceRepository, prisma as any);
  });

  it('should create instance with default thematiques', async () => {
    const result = await useCase.execute({ name: 'Test', slug: 'test' });
    expect(result).toBe(mockInstance);
    expect(instanceRepository.create).toHaveBeenCalled();
    expect(prisma.group.create).toHaveBeenCalledTimes(4);
    expect(prisma.group.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Environnement', slug: 'environnement', instanceId: 'inst-1' }),
      }),
    );
  });

  it('should create instance with custom thematiques', async () => {
    const result = await useCase.execute({ name: 'Test', slug: 'test', thematiques: ['A', 'B'] });
    expect(result).toBe(mockInstance);
    expect(prisma.group.create).toHaveBeenCalledTimes(2);
  });
});
