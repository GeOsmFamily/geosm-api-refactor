import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetDashboardUseCase');

export interface DashboardStats {
  instanceCount: number;
  userCount: number;
  exportCount: number;
  themeCount: number;
}

export class GetDashboardUseCase {
  constructor(
    private readonly instanceRepository: IInstanceRepository,
    private readonly userRepository: IUserRepository,
    private readonly exportRepository: IExportRepository,
    private readonly defaultThemeRepository: IDefaultThemeRepository,
  ) {}

  async execute(): Promise<DashboardStats> {
    const [instances, users, exportCount, themeCount] = await Promise.all([
      this.instanceRepository.findAll({ limit: 1 }),
      this.userRepository.findAll({ limit: 1 }),
      this.exportRepository.count(),
      this.defaultThemeRepository.count(),
    ]);

    logger.debug('Dashboard stats retrieved', { instanceCount: instances.total, userCount: users.total, exportCount, themeCount });
    return {
      instanceCount: instances.total,
      userCount: users.total,
      exportCount,
      themeCount,
    };
  }
}
