import { ILayerSubGroupRepository } from '../../../domain/repositories/layer-sub-group.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteLayerSubGroupUseCase');

export class DeleteLayerSubGroupUseCase {
  constructor(private readonly layerSubGroupRepository: ILayerSubGroupRepository) {}

  async execute(id: string): Promise<void> {
    const subGroup = await this.layerSubGroupRepository.findById(id);
    if (!subGroup) throw new NotFoundError('LayerSubGroup', id);
    await this.layerSubGroupRepository.delete(id);
    logger.info('Sub-group deleted', { subGroupId: id });
  }
}
