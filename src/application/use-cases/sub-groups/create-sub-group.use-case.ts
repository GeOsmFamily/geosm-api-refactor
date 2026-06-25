import { v4 as uuidv4 } from 'uuid';
import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { CreateSubGroupDTO } from '../../dtos/sub-group.dto.js';
import { SubGroup } from '../../../domain/entities/sub-group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';

export class CreateSubGroupUseCase {
  constructor(
    private readonly subGroupRepository: ISubGroupRepository,
    private readonly groupRepository: IGroupRepository,
  ) {}

  async execute(groupId: string, dto: CreateSubGroupDTO): Promise<SubGroup> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) throw new NotFoundError('Group', groupId);

    const slug = Slug.create(dto.slug);
    const existing = await this.subGroupRepository.findBySlug(slug.value, groupId);
    if (existing) throw new ConflictError('SubGroup with this slug already exists in this group');

    return this.subGroupRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      order: dto.order ?? 0,
      isActive: true,
      groupId,
    });
  }
}
