import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { Group } from '../../../domain/entities/group.entity.js';

export class ListGroupsUseCase {
  constructor(private readonly groupRepository: IGroupRepository) {}

  async execute(instanceId: string, includeSubGroups?: boolean): Promise<Group[]> {
    return this.groupRepository.findByInstance(instanceId, includeSubGroups);
  }
}
