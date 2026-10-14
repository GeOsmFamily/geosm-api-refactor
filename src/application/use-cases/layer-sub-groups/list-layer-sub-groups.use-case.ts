import { ILayerSubGroupRepository } from '../../../domain/repositories/layer-sub-group.repository.js';
import { LayerSubGroup } from '../../../domain/entities/layer-sub-group.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListLayerSubGroupsUseCase');

export class ListLayerSubGroupsUseCase {
  constructor(private readonly layerSubGroupRepository: ILayerSubGroupRepository) {}

  async execute(groupId: string): Promise<LayerSubGroup[]> {
    logger.debug('Listing sub-groups', { groupId });
    return this.layerSubGroupRepository.findByLayerGroup(groupId);
  }
}
