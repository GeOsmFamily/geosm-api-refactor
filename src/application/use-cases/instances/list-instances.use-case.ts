import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { ListInstancesDTO } from '../../dtos/instance.dto.js';
import { Instance } from '../../../domain/entities/instance.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListInstancesUseCase');

export class ListInstancesUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(dto: ListInstancesDTO): Promise<{ data: Instance[]; total: number }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    logger.debug('Listing instances', { page, limit, search: dto.search, isActive: dto.isActive });
    return this.instanceRepository.findAll({ page, limit, search: dto.search, isActive: dto.isActive });
  }
}
