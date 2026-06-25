import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetDashboardUseCase } from '../../../../../src/application/use-cases/admin/get-dashboard.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IExportRepository } from '../../../../../src/domain/repositories/export.repository.js';
import type { IDefaultThemeRepository } from '../../../../../src/domain/repositories/default-theme.repository.js';

describe('GetDashboardUseCase', () => {
  let useCase: GetDashboardUseCase;
  let instanceRepository: IInstanceRepository;
  let userRepository: IUserRepository;
  let exportRepository: IExportRepository;
  let defaultThemeRepository: IDefaultThemeRepository;

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findInstanceUsers: vi.fn(),
      addInstanceUser: vi.fn(),
      removeInstanceUser: vi.fn(),
      changeInstanceUserRole: vi.fn(),
      findInstanceUser: vi.fn(),
    };
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      existsByEmail: vi.fn(),
    };
    exportRepository = {
      findById: vi.fn(),
      findByUser: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    };
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
    useCase = new GetDashboardUseCase(instanceRepository, userRepository, exportRepository, defaultThemeRepository);
  });

  it('should return dashboard stats', async () => {
    vi.mocked(instanceRepository.findAll).mockResolvedValue({ data: [], total: 5 });
    vi.mocked(userRepository.findAll).mockResolvedValue({ data: [], total: 42 });
    vi.mocked(exportRepository.count).mockResolvedValue(10);
    vi.mocked(defaultThemeRepository.count).mockResolvedValue(3);

    const result = await useCase.execute();

    expect(result).toEqual({
      instanceCount: 5,
      userCount: 42,
      exportCount: 10,
      themeCount: 3,
    });
  });

  it('should return zeros when no data exists', async () => {
    vi.mocked(instanceRepository.findAll).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(userRepository.findAll).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(exportRepository.count).mockResolvedValue(0);
    vi.mocked(defaultThemeRepository.count).mockResolvedValue(0);

    const result = await useCase.execute();

    expect(result).toEqual({
      instanceCount: 0,
      userCount: 0,
      exportCount: 0,
      themeCount: 0,
    });
  });
});
