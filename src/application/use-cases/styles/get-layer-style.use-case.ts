import { ILayerStyleRepository } from '../../../domain/repositories/layer-style.repository.js';
import { LayerStyle } from '../../../domain/entities/layer-style.entity.js';

export class GetLayerStyleUseCase {
  constructor(
    private readonly layerStyleRepository: ILayerStyleRepository,
  ) {}

  async execute(layerId: string): Promise<LayerStyle[]> {
    return this.layerStyleRepository.findByLayerId(layerId);
  }
}
