import { IBaseMapRepository } from '../../../domain/repositories/base-map.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteBaseMapUseCase');

export class DeleteBaseMapUseCase {
  constructor(private readonly baseMapRepository: IBaseMapRepository) {}

  async execute(id: string): Promise<void> {
    const baseMap = await this.baseMapRepository.findById(id);
    if (!baseMap) throw new NotFoundError('BaseMap', id);
    await this.baseMapRepository.delete(id);
    logger.info('Base map deleted', { baseMapId: id });
  }
}
