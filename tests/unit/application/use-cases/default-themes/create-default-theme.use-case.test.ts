import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateDefaultThemeUseCase } from '../../../../../src/application/use-cases/default-themes/create-default-theme.use-case.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import type { IDefaultThemeRepository } from '../../../../../src/domain/repositories/default-theme.repository.js';
import { DefaultTheme } from '../../../../../src/domain/entities/default-theme.entity.js';

describe('CreateDefaultThemeUseCase', () => {
  let useCase: CreateDefaultThemeUseCase;
  let defaultThemeRepository: IDefaultThemeRepository;
  const now = new Date();

  beforeEach(() => {
    defaultThemeRepository = {
      findAll: vi.fn(), findBySlug: vi.fn(), findById: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(),
      findTagsByThemeId: vi.fn(), createTag: vi.fn(),
    };
    useCase = new CreateDefaultThemeUseCase(defaultThemeRepository);
  });

  it('should create theme successfully', async () => {
    vi.mocked(defaultThemeRepository.findBySlug).mockResolvedValue(null);
    const mockTheme = new DefaultTheme({ id: 't1', name: 'Water', slug: 'water', icon: null, color: null, order: 0, createdAt: now, updatedAt: now });
    vi.mocked(defaultThemeRepository.create).mockResolvedValue(mockTheme);
    const result = await useCase.execute({ name: 'Water', slug: 'water' });
    expect(result.name).toBe('Water');
  });

  it('should throw ConflictError when slug exists', async () => {
    vi.mocked(defaultThemeRepository.findBySlug).mockResolvedValue({} as any);
    await expect(useCase.execute({ name: 'Water', slug: 'water' })).rejects.toThrow(ConflictError);
  });
});
