import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetDefaultThemeUseCase');

export class GetDefaultThemeUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(id: string): Promise<DefaultTheme> {
    logger.debug('Fetching default theme', { themeId: id });
    const theme = await this.defaultThemeRepository.findById(id);
    if (!theme) throw new NotFoundError('DefaultTheme', id);
    return theme;
  }
}
