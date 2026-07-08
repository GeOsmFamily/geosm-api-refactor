import { IBaseMapRepository } from '../../../domain/repositories/base-map.repository.js';
import { BaseMap } from '../../../domain/entities/base-map.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListBaseMapsUseCase');

export class ListBaseMapsUseCase {
  constructor(private readonly baseMapRepository: IBaseMapRepository) {}

  async execute(instanceId: string): Promise<BaseMap[]> {
    logger.debug('Listing base maps', { instanceId });
    return this.baseMapRepository.findByInstance(instanceId);
  }
}
