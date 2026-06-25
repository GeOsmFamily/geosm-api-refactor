import { IBaseMapRepository } from '../../../domain/repositories/base-map.repository.js';
import { BaseMap } from '../../../domain/entities/base-map.entity.js';

export class ListBaseMapsUseCase {
  constructor(private readonly baseMapRepository: IBaseMapRepository) {}

  async execute(instanceId: string): Promise<BaseMap[]> {
    return this.baseMapRepository.findByInstance(instanceId);
  }
}
