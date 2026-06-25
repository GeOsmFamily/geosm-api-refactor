import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteExportUseCase {
  constructor(
    private readonly exportRepository: IExportRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.exportRepository.findById(id);
    if (!existing) throw new NotFoundError('Export', id);
    await this.exportRepository.delete(id);
  }
}
