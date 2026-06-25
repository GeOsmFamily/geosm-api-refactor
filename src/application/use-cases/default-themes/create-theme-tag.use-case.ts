import { v4 as uuidv4 } from 'uuid';
import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { CreateDefaultTagDTO } from '../../dtos/default-theme.dto.js';
import { DefaultTag } from '../../../domain/entities/default-tag.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';

export class CreateThemeTagUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(themeId: string, dto: CreateDefaultTagDTO): Promise<DefaultTag> {
    const theme = await this.defaultThemeRepository.findById(themeId);
    if (!theme) throw new NotFoundError('DefaultTheme', themeId);

    const slug = Slug.create(dto.slug);

    return this.defaultThemeRepository.createTag({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      themeId,
    });
  }
}
