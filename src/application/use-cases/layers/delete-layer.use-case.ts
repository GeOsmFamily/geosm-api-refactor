import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { RemoveLayerIndexUseCase } from '../search/remove-layer-index.use-case.js';

export class DeleteLayerUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly removeLayerIndexUseCase?: RemoveLayerIndexUseCase,
  ) {}

  async execute(id: string): Promise<void> {
    const layer = await this.layerRepository.findById(id);
    if (!layer) throw new NotFoundError('Layer', id);
    await this.layerRepository.delete(id);

    try {
      await this.removeLayerIndexUseCase?.execute(id);
    } catch {
      // Non-critical
    }
  }
}
