import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteInstanceUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(id: string): Promise<void> {
    const instance = await this.instanceRepository.findById(id);
    if (!instance) throw new NotFoundError('Instance', id);
    await this.instanceRepository.delete(id);
  }
}
