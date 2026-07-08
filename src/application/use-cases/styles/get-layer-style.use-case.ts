import { ILayerStyleRepository } from '../../../domain/repositories/layer-style.repository.js';
import { LayerStyle } from '../../../domain/entities/layer-style.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetLayerStyleUseCase');

export class GetLayerStyleUseCase {
  constructor(private readonly layerStyleRepository: ILayerStyleRepository) {}

  async execute(layerId: string): Promise<LayerStyle[]> {
    logger.debug('Getting layer style', { layerId });
    return this.layerStyleRepository.findByLayerId(layerId);
  }
}
