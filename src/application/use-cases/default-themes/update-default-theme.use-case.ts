import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { UpdateDefaultThemeDTO } from '../../dtos/default-theme.dto.js';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateDefaultThemeUseCase');

export class UpdateDefaultThemeUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(id: string, dto: UpdateDefaultThemeDTO): Promise<DefaultTheme> {
    const theme = await this.defaultThemeRepository.findById(id);
    if (!theme) {
      logger.warn('Update default theme rejected: not found', { themeId: id });
      throw new NotFoundError('DefaultTheme', id);
    }

    const updated = await this.defaultThemeRepository.update(id, dto);
    logger.info('Default theme updated', { themeId: id });
    return updated;
  }
}
