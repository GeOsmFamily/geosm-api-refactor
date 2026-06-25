import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class RemoveInstanceUserUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(instanceId: string, userId: string): Promise<void> {
    const existing = await this.instanceRepository.findInstanceUser(instanceId, userId);
    if (!existing) throw new NotFoundError('InstanceUser');
    await this.instanceRepository.removeInstanceUser(instanceId, userId);
  }
}
