import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteGroupUseCase {
  constructor(private readonly groupRepository: IGroupRepository) {}

  async execute(id: string): Promise<void> {
    const group = await this.groupRepository.findById(id);
    if (!group) throw new NotFoundError('Group', id);
    await this.groupRepository.delete(id);
  }
}
