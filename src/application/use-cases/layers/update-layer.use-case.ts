import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { UpdateLayerDTO } from '../../dtos/layer.dto.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { IndexLayerUseCase } from '../search/index-layer.use-case.js';

export class UpdateLayerUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly indexLayerUseCase?: IndexLayerUseCase,
  ) {}

  async execute(id: string, dto: UpdateLayerDTO): Promise<Layer> {
    const existing = await this.layerRepository.findById(id);
    if (!existing) throw new NotFoundError('Layer', id);
    const layer = await this.layerRepository.update(id, dto);

    try {
      await this.indexLayerUseCase?.execute(layer);
    } catch {
      // Non-critical
    }

    return layer;
  }
}
