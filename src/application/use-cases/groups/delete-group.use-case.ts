import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteGroupUseCase');

export class DeleteGroupUseCase {
  constructor(private readonly groupRepository: IGroupRepository) {}

  async execute(id: string): Promise<void> {
    const group = await this.groupRepository.findById(id);
    if (!group) throw new NotFoundError('Group', id);
    await this.groupRepository.delete(id);
    logger.info('Group deleted', { groupId: id, instanceId: group.instanceId });
  }
}
