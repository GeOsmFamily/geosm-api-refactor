import { IBaseMapRepository } from '../../../domain/repositories/base-map.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteBaseMapUseCase {
  constructor(private readonly baseMapRepository: IBaseMapRepository) {}

  async execute(id: string): Promise<void> {
    const baseMap = await this.baseMapRepository.findById(id);
    if (!baseMap) throw new NotFoundError('BaseMap', id);
    await this.baseMapRepository.delete(id);
  }
}
