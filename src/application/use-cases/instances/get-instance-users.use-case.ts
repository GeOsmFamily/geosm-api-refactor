import {
  IInstanceRepository,
  InstanceUserRecord,
} from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetInstanceUsersUseCase');

export class GetInstanceUsersUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(instanceId: string): Promise<InstanceUserRecord[]> {
    logger.debug('Fetching instance users', { instanceId });
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);
    return this.instanceRepository.findInstanceUsers(instanceId);
  }
}
