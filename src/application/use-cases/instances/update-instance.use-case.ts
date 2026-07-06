import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { UpdateInstanceDTO } from '../../dtos/instance.dto.js';
import { Instance } from '../../../domain/entities/instance.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateInstanceUseCase');

export class UpdateInstanceUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(id: string, dto: UpdateInstanceDTO): Promise<Instance> {
    const existing = await this.instanceRepository.findById(id);
    if (!existing) throw new NotFoundError('Instance', id);
    const instance = await this.instanceRepository.update(id, dto);
    logger.info('Instance updated', { instanceId: id });
    return instance;
  }
}
