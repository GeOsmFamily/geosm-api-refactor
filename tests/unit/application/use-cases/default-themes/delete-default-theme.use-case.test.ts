import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteDefaultThemeUseCase } from '../../../../../src/application/use-cases/default-themes/delete-default-theme.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IDefaultThemeRepository } from '../../../../../src/domain/repositories/default-theme.repository.js';
import { DefaultTheme } from '../../../../../src/domain/entities/default-theme.entity.js';

describe('DeleteDefaultThemeUseCase', () => {
  let useCase: DeleteDefaultThemeUseCase;
  let defaultThemeRepository: IDefaultThemeRepository;
  const now = new Date();
  const mockTheme = new DefaultTheme({ id: 't1', name: 'Water', slug: 'water', icon: null, color: null, order: 0, createdAt: now, updatedAt: now });

  beforeEach(() => {
    defaultThemeRepository = {
      findAll: vi.fn(), findBySlug: vi.fn(), findById: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(),
      findTagsByThemeId: vi.fn(), createTag: vi.fn(),
    };
    useCase = new DeleteDefaultThemeUseCase(defaultThemeRepository);
  });

  it('should delete theme when found', async () => {
    vi.mocked(defaultThemeRepository.findById).mockResolvedValue(mockTheme);
    await useCase.execute('t1');
    expect(defaultThemeRepository.delete).toHaveBeenCalledWith('t1');
  });

  it('should throw NotFoundError when not found', async () => {
    vi.mocked(defaultThemeRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('t1')).rejects.toThrow(NotFoundError);
  });
});
