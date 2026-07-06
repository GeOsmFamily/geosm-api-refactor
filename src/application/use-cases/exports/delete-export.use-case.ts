import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteExportUseCase');

export class DeleteExportUseCase {
  constructor(
    private readonly exportRepository: IExportRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.exportRepository.findById(id);
    if (!existing) throw new NotFoundError('Export', id);
    await this.exportRepository.delete(id);
    logger.info('Export deleted', { exportId: id });
  }
}
