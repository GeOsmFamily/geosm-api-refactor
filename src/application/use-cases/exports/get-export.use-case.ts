import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { Export } from '../../../domain/entities/export.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetExportUseCase');

export class GetExportUseCase {
  constructor(private readonly exportRepository: IExportRepository) {}

  async execute(id: string): Promise<Export> {
    logger.debug('Getting export', { exportId: id });
    const result = await this.exportRepository.findById(id);
    if (!result) throw new NotFoundError('Export', id);
    return result;
  }
}
