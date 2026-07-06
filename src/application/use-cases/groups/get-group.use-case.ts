import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { Group } from '../../../domain/entities/group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetGroupUseCase');

export class GetGroupUseCase {
  constructor(private readonly groupRepository: IGroupRepository) {}

  async execute(id: string): Promise<Group> {
    logger.debug('Fetching group', { groupId: id });
    const group = await this.groupRepository.findById(id);
    if (!group) throw new NotFoundError('Group', id);
    return group;
  }
}
