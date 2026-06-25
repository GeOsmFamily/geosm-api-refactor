import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { ReorderGroupsDTO } from '../../dtos/group.dto.js';

export class ReorderGroupsUseCase {
  constructor(private readonly groupRepository: IGroupRepository) {}

  async execute(dto: ReorderGroupsDTO): Promise<void> {
    for (const item of dto.orders) {
      await this.groupRepository.updateOrder(item.id, item.order);
    }
  }
}
