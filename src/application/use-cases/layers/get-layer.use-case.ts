import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetLayerUseCase {
  constructor(private readonly layerRepository: ILayerRepository) {}

  async execute(id: string): Promise<Layer> {
    const layer = await this.layerRepository.findById(id);
    if (!layer) throw new NotFoundError('Layer', id);
    return layer;
  }
}
