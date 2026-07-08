import { IBaseMapRepository } from '../../../domain/repositories/base-map.repository.js';
import { UpdateBaseMapDTO } from '../../dtos/base-map.dto.js';
import { BaseMap } from '../../../domain/entities/base-map.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateBaseMapUseCase');

export class UpdateBaseMapUseCase {
  constructor(private readonly baseMapRepository: IBaseMapRepository) {}

  async execute(id: string, dto: UpdateBaseMapDTO): Promise<BaseMap> {
    const existing = await this.baseMapRepository.findById(id);
    if (!existing) throw new NotFoundError('BaseMap', id);
    const updated = await this.baseMapRepository.update(id, dto);
    logger.info('Base map updated', { baseMapId: id });
    return updated;
  }
}
