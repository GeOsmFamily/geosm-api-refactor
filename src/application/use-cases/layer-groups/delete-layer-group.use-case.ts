import { ILayerGroupRepository } from '../../../domain/repositories/layer-group.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteLayerGroupUseCase');

export class DeleteLayerGroupUseCase {
  constructor(private readonly layerGroupRepository: ILayerGroupRepository) {}

  async execute(id: string): Promise<void> {
    const group = await this.layerGroupRepository.findById(id);
    if (!group) throw new NotFoundError('LayerGroup', id);
    await this.layerGroupRepository.delete(id);
    logger.info('LayerGroup deleted', { groupId: id, instanceId: group.instanceId });
  }
}
