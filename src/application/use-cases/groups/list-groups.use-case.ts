import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { Group } from '../../../domain/entities/group.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListGroupsUseCase');

export class ListGroupsUseCase {
  constructor(private readonly groupRepository: IGroupRepository) {}

  async execute(instanceId: string, includeSubGroups?: boolean): Promise<Group[]> {
    logger.debug('Listing groups', { instanceId, includeSubGroups });
    return this.groupRepository.findByInstance(instanceId, includeSubGroups);
  }
}
