import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { UpdateDefaultThemeDTO } from '../../dtos/default-theme.dto.js';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class UpdateDefaultThemeUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(id: string, dto: UpdateDefaultThemeDTO): Promise<DefaultTheme> {
    const theme = await this.defaultThemeRepository.findById(id);
    if (!theme) throw new NotFoundError('DefaultTheme', id);

    return this.defaultThemeRepository.update(id, dto);
  }
}
