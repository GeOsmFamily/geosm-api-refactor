import { ILayerStyleRepository } from '../../../domain/repositories/layer-style.repository.js';
import { LayerStyle } from '../../../domain/entities/layer-style.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class UpdateLayerStyleUseCase {
  constructor(
    private readonly layerStyleRepository: ILayerStyleRepository,
  ) {}

  async execute(id: string, data: Partial<Omit<LayerStyle, 'id' | 'createdAt' | 'updatedAt'>>): Promise<LayerStyle> {
    const existing = await this.layerStyleRepository.findById(id);
    if (!existing) throw new NotFoundError('LayerStyle', id);
    return this.layerStyleRepository.update(id, data);
  }
}
