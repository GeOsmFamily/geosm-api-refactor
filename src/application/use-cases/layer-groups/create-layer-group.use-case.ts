import { v4 as uuidv4 } from 'uuid';
import { ILayerGroupRepository } from '../../../domain/repositories/layer-group.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { CreateLayerGroupDTO } from '../../dtos/layer-group.dto.js';
import { LayerGroup } from '../../../domain/entities/layer-group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateLayerGroupUseCase');

export class CreateLayerGroupUseCase {
  constructor(
    private readonly layerGroupRepository: ILayerGroupRepository,
    private readonly instanceRepository: IInstanceRepository,
  ) {}

  async execute(instanceId: string, dto: CreateLayerGroupDTO): Promise<LayerGroup> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);

    const slug = Slug.create(dto.slug);
    const existing = await this.layerGroupRepository.findBySlug(slug.value, instanceId);
    if (existing) {
      logger.warn('Create group rejected: slug already exists in instance', {
        instanceId,
        slug: slug.value,
      });
      throw new ConflictError('LayerGroup with this slug already exists in this instance');
    }

    const group = await this.layerGroupRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      color: dto.color ?? null,
      order: dto.order ?? 0,
      isActive: true,
      instanceId,
    });
    logger.info('LayerGroup created', { groupId: group.id, instanceId, slug: slug.value });
    return group;
  }
}
