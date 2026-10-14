import { ILayerGroupRepository } from '../../../domain/repositories/layer-group.repository.js';
import { ReorderLayerGroupsDTO } from '../../dtos/layer-group.dto.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ReorderLayerGroupsUseCase');

export class ReorderLayerGroupsUseCase {
  constructor(private readonly layerGroupRepository: ILayerGroupRepository) {}

  async execute(dto: ReorderLayerGroupsDTO): Promise<void> {
    for (const item of dto.orders) {
      await this.layerGroupRepository.updateOrder(item.id, item.order);
    }
    logger.info('LayerGroups reordered', { count: dto.orders.length });
  }
}
