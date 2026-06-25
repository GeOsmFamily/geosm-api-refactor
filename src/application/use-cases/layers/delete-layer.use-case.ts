import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteLayerUseCase {
  constructor(private readonly layerRepository: ILayerRepository) {}

  async execute(id: string): Promise<void> {
    const layer = await this.layerRepository.findById(id);
    if (!layer) throw new NotFoundError('Layer', id);
    await this.layerRepository.delete(id);
  }
}
