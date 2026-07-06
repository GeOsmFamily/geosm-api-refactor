import { v4 as uuidv4 } from 'uuid';
import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { CreateGroupDTO } from '../../dtos/group.dto.js';
import { Group } from '../../../domain/entities/group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateGroupUseCase');

export class CreateGroupUseCase {
  constructor(
    private readonly groupRepository: IGroupRepository,
    private readonly instanceRepository: IInstanceRepository,
  ) {}

  async execute(instanceId: string, dto: CreateGroupDTO): Promise<Group> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);

    const slug = Slug.create(dto.slug);
    const existing = await this.groupRepository.findBySlug(slug.value, instanceId);
    if (existing) {
      logger.warn('Create group rejected: slug already exists in instance', { instanceId, slug: slug.value });
      throw new ConflictError('Group with this slug already exists in this instance');
    }

    const group = await this.groupRepository.create({
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
    logger.info('Group created', { groupId: group.id, instanceId, slug: slug.value });
    return group;
  }
}
