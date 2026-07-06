import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { UpdateLayerDTO } from '../../dtos/layer.dto.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { IndexLayerUseCase } from '../search/index-layer.use-case.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateLayerUseCase');

export class UpdateLayerUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly indexLayerUseCase?: IndexLayerUseCase,
  ) {}

  async execute(id: string, dto: UpdateLayerDTO): Promise<Layer> {
    const existing = await this.layerRepository.findById(id);
    if (!existing) throw new NotFoundError('Layer', id);
    const layer = await this.layerRepository.update(id, dto);
    logger.info('Layer updated', { layerId: id });

    try {
      await this.indexLayerUseCase?.execute(layer);
    } catch (error) {
      logger.warn('Failed to re-index updated layer', { layerId: id, error: error instanceof Error ? error.message : String(error) });
    }

    return layer;
  }
}
