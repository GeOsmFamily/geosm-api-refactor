import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteDefaultThemeUseCase');

export class DeleteDefaultThemeUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(id: string): Promise<void> {
    const theme = await this.defaultThemeRepository.findById(id);
    if (!theme) {
      logger.warn('Delete default theme rejected: not found', { themeId: id });
      throw new NotFoundError('DefaultTheme', id);
    }

    await this.defaultThemeRepository.delete(id);
    logger.info('Default theme deleted', { themeId: id, slug: theme.slug });
  }
}
