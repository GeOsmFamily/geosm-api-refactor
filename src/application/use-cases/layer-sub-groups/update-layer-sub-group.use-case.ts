import { ILayerSubGroupRepository } from '../../../domain/repositories/layer-sub-group.repository.js';
import { UpdateLayerSubGroupDTO } from '../../dtos/layer-sub-group.dto.js';
import { LayerSubGroup } from '../../../domain/entities/layer-sub-group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateLayerSubGroupUseCase');

export class UpdateLayerSubGroupUseCase {
  constructor(private readonly layerSubGroupRepository: ILayerSubGroupRepository) {}

  async execute(id: string, dto: UpdateLayerSubGroupDTO): Promise<LayerSubGroup> {
    const existing = await this.layerSubGroupRepository.findById(id);
    if (!existing) throw new NotFoundError('LayerSubGroup', id);
    const updated = await this.layerSubGroupRepository.update(id, dto);
    logger.info('Sub-group updated', { subGroupId: id });
    return updated;
  }
}
