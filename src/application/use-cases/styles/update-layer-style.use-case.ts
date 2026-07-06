import { ILayerStyleRepository } from '../../../domain/repositories/layer-style.repository.js';
import { LayerStyle } from '../../../domain/entities/layer-style.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateLayerStyleUseCase');

export class UpdateLayerStyleUseCase {
  constructor(
    private readonly layerStyleRepository: ILayerStyleRepository,
  ) {}

  async execute(id: string, data: Partial<Omit<LayerStyle, 'id' | 'createdAt' | 'updatedAt'>>): Promise<LayerStyle> {
    const existing = await this.layerStyleRepository.findById(id);
    if (!existing) throw new NotFoundError('LayerStyle', id);
    const updated = await this.layerStyleRepository.update(id, data);
    logger.info('Layer style updated', { layerStyleId: id });
    return updated;
  }
}
