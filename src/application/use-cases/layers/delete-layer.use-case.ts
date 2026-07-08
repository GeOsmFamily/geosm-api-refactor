import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { RemoveLayerIndexUseCase } from '../search/remove-layer-index.use-case.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteLayerUseCase');

export class DeleteLayerUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly removeLayerIndexUseCase?: RemoveLayerIndexUseCase,
  ) {}

  async execute(id: string): Promise<void> {
    const layer = await this.layerRepository.findById(id);
    if (!layer) throw new NotFoundError('Layer', id);
    await this.layerRepository.delete(id);
    logger.info('Layer deleted', { layerId: id });

    try {
      await this.removeLayerIndexUseCase?.execute(id);
    } catch (error) {
      logger.warn('Failed to remove search index for deleted layer', {
        layerId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
