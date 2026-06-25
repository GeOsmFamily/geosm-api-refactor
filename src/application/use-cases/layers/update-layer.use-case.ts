import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { UpdateLayerDTO } from '../../dtos/layer.dto.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class UpdateLayerUseCase {
  constructor(private readonly layerRepository: ILayerRepository) {}

  async execute(id: string, dto: UpdateLayerDTO): Promise<Layer> {
    const existing = await this.layerRepository.findById(id);
    if (!existing) throw new NotFoundError('Layer', id);
    return this.layerRepository.update(id, dto);
  }
}
