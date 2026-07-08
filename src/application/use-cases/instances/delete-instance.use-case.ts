import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteInstanceUseCase');

export class DeleteInstanceUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(id: string): Promise<void> {
    const instance = await this.instanceRepository.findById(id);
    if (!instance) throw new NotFoundError('Instance', id);
    await this.instanceRepository.delete(id);
    logger.warn('Instance deleted', { instanceId: id, name: instance.name });
  }
}
