import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { UpdateInstanceDTO } from '../../dtos/instance.dto.js';
import { Instance } from '../../../domain/entities/instance.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class UpdateInstanceUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(id: string, dto: UpdateInstanceDTO): Promise<Instance> {
    const existing = await this.instanceRepository.findById(id);
    if (!existing) throw new NotFoundError('Instance', id);
    return this.instanceRepository.update(id, dto);
  }
}
