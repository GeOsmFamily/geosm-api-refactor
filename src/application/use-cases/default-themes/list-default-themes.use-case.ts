import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';

export class ListDefaultThemesUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(): Promise<DefaultTheme[]> {
    return this.defaultThemeRepository.findAll();
  }
}
