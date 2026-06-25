import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { DefaultTag } from '../../../domain/entities/default-tag.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetThemeTagsUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(themeId: string): Promise<DefaultTag[]> {
    const theme = await this.defaultThemeRepository.findById(themeId);
    if (!theme) throw new NotFoundError('DefaultTheme', themeId);

    return this.defaultThemeRepository.findTagsByThemeId(themeId);
  }
}
