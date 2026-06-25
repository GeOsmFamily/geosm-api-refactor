import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { Instance } from '../../../domain/entities/instance.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetInstanceUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(id: string): Promise<Instance> {
    const instance = await this.instanceRepository.findById(id);
    if (!instance) throw new NotFoundError('Instance', id);
    return instance;
  }
}
