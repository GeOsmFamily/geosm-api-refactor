import { ILayerGroupRepository } from '../../../domain/repositories/layer-group.repository.js';
import { UpdateLayerGroupDTO } from '../../dtos/layer-group.dto.js';
import { LayerGroup } from '../../../domain/entities/layer-group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateLayerGroupUseCase');

export class UpdateLayerGroupUseCase {
  constructor(private readonly layerGroupRepository: ILayerGroupRepository) {}

  async execute(id: string, dto: UpdateLayerGroupDTO): Promise<LayerGroup> {
    const existing = await this.layerGroupRepository.findById(id);
    if (!existing) throw new NotFoundError('LayerGroup', id);
    const group = await this.layerGroupRepository.update(id, dto);
    logger.info('LayerGroup updated', { groupId: id });
    return group;
  }
}
