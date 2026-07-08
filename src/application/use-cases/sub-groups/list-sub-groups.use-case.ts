import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { SubGroup } from '../../../domain/entities/sub-group.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListSubGroupsUseCase');

export class ListSubGroupsUseCase {
  constructor(private readonly subGroupRepository: ISubGroupRepository) {}

  async execute(groupId: string): Promise<SubGroup[]> {
    logger.debug('Listing sub-groups', { groupId });
    return this.subGroupRepository.findByGroup(groupId);
  }
}
