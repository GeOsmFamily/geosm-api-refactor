import { MeiliSearchService } from '../../../infrastructure/external-apis/meilisearch.service.js';
import { Layer } from '../../../domain/entities/layer.entity.js';

const LAYERS_INDEX = 'layers';

export class IndexLayerUseCase {
  constructor(private readonly meiliSearchService: MeiliSearchService) {}

  async execute(layer: Layer): Promise<void> {
    const document = {
      id: layer.id,
      name: layer.name,
      slug: layer.slug,
      description: layer.description,
      geometryType: layer.geometryType,
      instanceId: layer.instanceId,
      subGroupId: layer.subGroupId,
      metadata: layer.metadata,
    };
    await this.meiliSearchService.addDocuments(LAYERS_INDEX, [document], 'id');
  }
}
