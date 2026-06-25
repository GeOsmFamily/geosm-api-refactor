import { v4 as uuidv4 } from 'uuid';
import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { CreateDefaultThemeDTO } from '../../dtos/default-theme.dto.js';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';

export class CreateDefaultThemeUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(dto: CreateDefaultThemeDTO): Promise<DefaultTheme> {
    const slug = Slug.create(dto.slug);
    const existing = await this.defaultThemeRepository.findBySlug(slug.value);
    if (existing) throw new ConflictError('Default theme with this slug already exists');

    return this.defaultThemeRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      icon: dto.icon ?? null,
      color: dto.color ?? null,
      order: dto.order ?? 0,
    });
  }
}
