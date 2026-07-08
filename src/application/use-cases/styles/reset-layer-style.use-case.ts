import { ILayerStyleRepository } from '../../../domain/repositories/layer-style.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ResetLayerStyleUseCase');

export class ResetLayerStyleUseCase {
  constructor(private readonly layerStyleRepository: ILayerStyleRepository) {}

  async execute(layerId: string): Promise<void> {
    const styles = await this.layerStyleRepository.findByLayerId(layerId);
    for (const style of styles) {
      if (!style.isDefault) {
        await this.layerStyleRepository.delete(style.id);
      }
    }
    logger.info('Layer style reset to default', { layerId });
  }
}
