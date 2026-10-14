import { v4 as uuidv4 } from 'uuid';
import { ILayerSubGroupRepository } from '../../../domain/repositories/layer-sub-group.repository.js';
import { ILayerGroupRepository } from '../../../domain/repositories/layer-group.repository.js';
import { CreateLayerSubGroupDTO } from '../../dtos/layer-sub-group.dto.js';
import { LayerSubGroup } from '../../../domain/entities/layer-sub-group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateLayerSubGroupUseCase');

export class CreateLayerSubGroupUseCase {
  constructor(
    private readonly layerSubGroupRepository: ILayerSubGroupRepository,
    private readonly layerGroupRepository: ILayerGroupRepository,
  ) {}

  async execute(groupId: string, dto: CreateLayerSubGroupDTO): Promise<LayerSubGroup> {
    const group = await this.layerGroupRepository.findById(groupId);
    if (!group) throw new NotFoundError('LayerGroup', groupId);

    const slug = Slug.create(dto.slug);
    const existing = await this.layerSubGroupRepository.findBySlug(slug.value, groupId);
    if (existing) throw new ConflictError('LayerSubGroup with this slug already exists in this group');

    const subGroup = await this.layerSubGroupRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      order: dto.order ?? 0,
      isActive: true,
      groupId,
    });
    logger.info('Sub-group created', { groupId, subGroupId: subGroup.id });
    return subGroup;
  }
}
