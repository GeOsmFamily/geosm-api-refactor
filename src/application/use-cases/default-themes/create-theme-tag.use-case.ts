import { v4 as uuidv4 } from 'uuid';
import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { CreateDefaultTagDTO } from '../../dtos/default-theme.dto.js';
import { DefaultTag } from '../../../domain/entities/default-tag.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateThemeTagUseCase');

export class CreateThemeTagUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(themeId: string, dto: CreateDefaultTagDTO): Promise<DefaultTag> {
    const theme = await this.defaultThemeRepository.findById(themeId);
    if (!theme) {
      logger.warn('Create theme tag rejected: theme not found', { themeId });
      throw new NotFoundError('DefaultTheme', themeId);
    }

    const slug = Slug.create(dto.slug);

    const tag = await this.defaultThemeRepository.createTag({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      themeId,
    });
    logger.info('Theme tag created', { tagId: tag.id, themeId, slug: tag.slug });
    return tag;
  }
}
