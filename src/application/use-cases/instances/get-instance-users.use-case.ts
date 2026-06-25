import { IInstanceRepository, InstanceUserRecord } from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetInstanceUsersUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(instanceId: string): Promise<InstanceUserRecord[]> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);
    return this.instanceRepository.findInstanceUsers(instanceId);
  }
}
