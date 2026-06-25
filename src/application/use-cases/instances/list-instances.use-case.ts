import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { ListInstancesDTO } from '../../dtos/instance.dto.js';
import { Instance } from '../../../domain/entities/instance.entity.js';

export class ListInstancesUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(dto: ListInstancesDTO): Promise<{ data: Instance[]; total: number }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    return this.instanceRepository.findAll({ page, limit, search: dto.search, isActive: dto.isActive });
  }
}
