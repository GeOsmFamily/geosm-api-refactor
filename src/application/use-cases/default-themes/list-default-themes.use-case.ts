import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListDefaultThemesUseCase');

export class ListDefaultThemesUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(): Promise<DefaultTheme[]> {
    logger.debug('Listing default themes');
    return this.defaultThemeRepository.findAll();
  }
}
