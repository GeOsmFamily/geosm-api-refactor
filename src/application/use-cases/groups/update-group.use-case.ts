import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { UpdateGroupDTO } from '../../dtos/group.dto.js';
import { Group } from '../../../domain/entities/group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class UpdateGroupUseCase {
  constructor(private readonly groupRepository: IGroupRepository) {}

  async execute(id: string, dto: UpdateGroupDTO): Promise<Group> {
    const existing = await this.groupRepository.findById(id);
    if (!existing) throw new NotFoundError('Group', id);
    return this.groupRepository.update(id, dto);
  }
}
