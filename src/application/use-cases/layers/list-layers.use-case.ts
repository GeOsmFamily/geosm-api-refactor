import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { ListLayersDTO } from '../../dtos/layer.dto.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListLayersUseCase');

export class ListLayersUseCase {
  constructor(private readonly layerRepository: ILayerRepository) {}

  async execute(instanceId: string, dto: ListLayersDTO): Promise<{ data: Layer[]; total: number }> {
    logger.debug('Listing layers', { instanceId });
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    return this.layerRepository.findByInstance(instanceId, {
      page,
      limit,
      search: dto.search,
      geometryType: dto.geometryType,
      subGroupId: dto.subGroupId,
    });
  }
}
