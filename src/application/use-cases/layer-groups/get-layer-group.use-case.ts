import { ILayerGroupRepository } from '../../../domain/repositories/layer-group.repository.js';
import { LayerGroup } from '../../../domain/entities/layer-group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetLayerGroupUseCase');

export class GetLayerGroupUseCase {
  constructor(private readonly layerGroupRepository: ILayerGroupRepository) {}

  async execute(id: string): Promise<LayerGroup> {
    logger.debug('Fetching group', { groupId: id });
    const group = await this.layerGroupRepository.findById(id);
    if (!group) throw new NotFoundError('LayerGroup', id);
    return group;
  }
}
