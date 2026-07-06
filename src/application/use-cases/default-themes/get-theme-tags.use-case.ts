import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { DefaultTag } from '../../../domain/entities/default-tag.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetThemeTagsUseCase');

export class GetThemeTagsUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(themeId: string): Promise<DefaultTag[]> {
    logger.debug('Fetching theme tags', { themeId });
    const theme = await this.defaultThemeRepository.findById(themeId);
    if (!theme) throw new NotFoundError('DefaultTheme', themeId);

    return this.defaultThemeRepository.findTagsByThemeId(themeId);
  }
}
