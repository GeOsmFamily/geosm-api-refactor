import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import type { Instance } from '../../../domain/entities/instance.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

/** Enfants directs d'une instance : les pays d'un continent, ou les regions d'un pays. */
export class GetInstanceChildrenUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(id: string): Promise<Instance[]> {
    const parent = await this.instanceRepository.findById(id);
    if (!parent) throw new NotFoundError('Instance', id);
    return this.instanceRepository.findChildren(id);
  }
}
