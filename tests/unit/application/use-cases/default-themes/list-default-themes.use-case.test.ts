import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListDefaultThemesUseCase } from '../../../../../src/application/use-cases/default-themes/list-default-themes.use-case.js';
import type { IDefaultThemeRepository } from '../../../../../src/domain/repositories/default-theme.repository.js';
import { DefaultTheme } from '../../../../../src/domain/entities/default-theme.entity.js';

describe('ListDefaultThemesUseCase', () => {
  let useCase: ListDefaultThemesUseCase;
  let defaultThemeRepository: IDefaultThemeRepository;
  const now = new Date();

  beforeEach(() => {
    defaultThemeRepository = {
      findAll: vi.fn(),
      findBySlug: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findTagsByThemeId: vi.fn(),
      createTag: vi.fn(),
    };
    useCase = new ListDefaultThemesUseCase(defaultThemeRepository);
  });

  it('should return all default themes', async () => {
    const themes = [
      new DefaultTheme({ id: 't1', name: 'Environment', slug: 'environment', icon: null, color: '#00ff00', order: 0, createdAt: now, updatedAt: now }),
      new DefaultTheme({ id: 't2', name: 'Transport', slug: 'transport', icon: null, color: '#0000ff', order: 1, createdAt: now, updatedAt: now }),
    ];
    vi.mocked(defaultThemeRepository.findAll).mockResolvedValue(themes);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Environment');
    expect(result[1].name).toBe('Transport');
    expect(defaultThemeRepository.findAll).toHaveBeenCalledOnce();
  });

  it('should return empty array when no themes exist', async () => {
    vi.mocked(defaultThemeRepository.findAll).mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });
});
