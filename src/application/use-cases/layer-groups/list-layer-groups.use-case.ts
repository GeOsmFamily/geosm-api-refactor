import { ILayerGroupRepository } from '../../../domain/repositories/layer-group.repository.js';
import { LayerGroup } from '../../../domain/entities/layer-group.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListLayerGroupsUseCase');

export class ListLayerGroupsUseCase {
  constructor(private readonly layerGroupRepository: ILayerGroupRepository) {}

  async execute(instanceId: string, includeSubGroups?: boolean): Promise<LayerGroup[]> {
    logger.debug('Listing groups', { instanceId, includeSubGroups });
    return this.layerGroupRepository.findByInstance(instanceId, includeSubGroups);
  }
}
