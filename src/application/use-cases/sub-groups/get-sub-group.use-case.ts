import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { SubGroup } from '../../../domain/entities/sub-group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetSubGroupUseCase');

export class GetSubGroupUseCase {
  constructor(private readonly subGroupRepository: ISubGroupRepository) {}

  async execute(id: string): Promise<SubGroup> {
    logger.debug('Getting sub-group', { subGroupId: id });
    const subGroup = await this.subGroupRepository.findById(id);
    if (!subGroup) throw new NotFoundError('SubGroup', id);
    return subGroup;
  }
}
