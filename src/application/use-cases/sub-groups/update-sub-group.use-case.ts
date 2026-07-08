import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { UpdateSubGroupDTO } from '../../dtos/sub-group.dto.js';
import { SubGroup } from '../../../domain/entities/sub-group.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateSubGroupUseCase');

export class UpdateSubGroupUseCase {
  constructor(private readonly subGroupRepository: ISubGroupRepository) {}

  async execute(id: string, dto: UpdateSubGroupDTO): Promise<SubGroup> {
    const existing = await this.subGroupRepository.findById(id);
    if (!existing) throw new NotFoundError('SubGroup', id);
    const updated = await this.subGroupRepository.update(id, dto);
    logger.info('Sub-group updated', { subGroupId: id });
    return updated;
  }
}
