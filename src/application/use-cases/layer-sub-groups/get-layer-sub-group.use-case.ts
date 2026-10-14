import { ILayerSubGroupRepository } from '../../../domain/repositories/layer-sub-group.repository.js';
import { LayerSubGroup } from '../../../domain/entities/layer-sub-group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetLayerSubGroupUseCase');

export class GetLayerSubGroupUseCase {
  constructor(private readonly layerSubGroupRepository: ILayerSubGroupRepository) {}

  async execute(id: string): Promise<LayerSubGroup> {
    logger.debug('Getting sub-group', { subGroupId: id });
    const subGroup = await this.layerSubGroupRepository.findById(id);
    if (!subGroup) throw new NotFoundError('LayerSubGroup', id);
    return subGroup;
  }
}
