import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteDefaultThemeUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(id: string): Promise<void> {
    const theme = await this.defaultThemeRepository.findById(id);
    if (!theme) throw new NotFoundError('DefaultTheme', id);

    await this.defaultThemeRepository.delete(id);
  }
}
