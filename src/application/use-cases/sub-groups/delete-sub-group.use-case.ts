import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteSubGroupUseCase');

export class DeleteSubGroupUseCase {
  constructor(private readonly subGroupRepository: ISubGroupRepository) {}

  async execute(id: string): Promise<void> {
    const subGroup = await this.subGroupRepository.findById(id);
    if (!subGroup) throw new NotFoundError('SubGroup', id);
    await this.subGroupRepository.delete(id);
    logger.info('Sub-group deleted', { subGroupId: id });
  }
}
