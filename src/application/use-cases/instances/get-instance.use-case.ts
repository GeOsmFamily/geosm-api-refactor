import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { Instance } from '../../../domain/entities/instance.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetInstanceUseCase');

export class GetInstanceUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(id: string): Promise<Instance> {
    logger.debug('Fetching instance', { instanceId: id });
    const instance = await this.instanceRepository.findById(id);
    if (!instance) throw new NotFoundError('Instance', id);
    return instance;
  }
}
