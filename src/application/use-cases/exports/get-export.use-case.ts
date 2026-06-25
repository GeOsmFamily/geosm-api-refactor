import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { Export } from '../../../domain/entities/export.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetExportUseCase {
  constructor(
    private readonly exportRepository: IExportRepository,
  ) {}

  async execute(id: string): Promise<Export> {
    const result = await this.exportRepository.findById(id);
    if (!result) throw new NotFoundError('Export', id);
    return result;
  }
}
