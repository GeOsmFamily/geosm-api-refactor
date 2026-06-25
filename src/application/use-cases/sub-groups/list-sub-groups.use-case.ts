import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { SubGroup } from '../../../domain/entities/sub-group.entity.js';

export class ListSubGroupsUseCase {
  constructor(private readonly subGroupRepository: ISubGroupRepository) {}

  async execute(groupId: string): Promise<SubGroup[]> {
    return this.subGroupRepository.findByGroup(groupId);
  }
}
