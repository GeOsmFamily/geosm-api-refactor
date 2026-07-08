import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetLayerUseCase');

export class GetLayerUseCase {
  constructor(private readonly layerRepository: ILayerRepository) {}

  async execute(id: string): Promise<Layer> {
    logger.debug('Getting layer', { layerId: id });
    const layer = await this.layerRepository.findById(id);
    if (!layer) throw new NotFoundError('Layer', id);
    return layer;
  }
}
