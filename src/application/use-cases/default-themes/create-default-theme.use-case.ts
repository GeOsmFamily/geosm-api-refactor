import { v4 as uuidv4 } from 'uuid';
import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { CreateDefaultThemeDTO } from '../../dtos/default-theme.dto.js';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateDefaultThemeUseCase');

export class CreateDefaultThemeUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(dto: CreateDefaultThemeDTO): Promise<DefaultTheme> {
    const slug = Slug.create(dto.slug);
    const existing = await this.defaultThemeRepository.findBySlug(slug.value);
    if (existing) {
      logger.warn('Create default theme rejected: slug already exists', { slug: slug.value });
      throw new ConflictError('Default theme with this slug already exists');
    }

    const theme = await this.defaultThemeRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      icon: dto.icon ?? null,
      color: dto.color ?? null,
      order: dto.order ?? 0,
    });
    logger.info('Default theme created', { themeId: theme.id, slug: theme.slug });
    return theme;
  }
}
