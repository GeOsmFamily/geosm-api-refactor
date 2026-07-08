import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('RemoveInstanceUserUseCase');

export class RemoveInstanceUserUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(instanceId: string, userId: string): Promise<void> {
    const existing = await this.instanceRepository.findInstanceUser(instanceId, userId);
    if (!existing) throw new NotFoundError('InstanceUser');
    await this.instanceRepository.removeInstanceUser(instanceId, userId);
    logger.info('User removed from instance', { instanceId, userId });
  }
}
