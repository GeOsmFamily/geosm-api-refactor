import { MeiliSearchService } from '../../../infrastructure/external-apis/meilisearch.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('RemoveLayerIndexUseCase');
const LAYERS_INDEX = 'layers';

export class RemoveLayerIndexUseCase {
  constructor(private readonly meiliSearchService: MeiliSearchService) {}

  async execute(layerId: string): Promise<void> {
    await this.meiliSearchService.deleteDocuments(LAYERS_INDEX, [layerId]);
    logger.info('Layer search index removed', { layerId });
  }
}
