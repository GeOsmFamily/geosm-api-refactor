import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type {
  LiveLayerService,
  LiveLayerConfig,
  LiveLayerResult,
} from '../../../infrastructure/external-apis/live-layer.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

function isLiveLayerConfig(value: unknown): value is LiveLayerConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LiveLayerConfig).url === 'string' &&
    typeof (value as LiveLayerConfig).ttlSeconds === 'number' &&
    typeof (value as LiveLayerConfig).refreshSeconds === 'number'
  );
}

/** Proxy+cache pour une couche vivante (voir LiveLayerService) - la config `{url, ttlSeconds,
 * refreshSeconds}` vit dans `Layer.metadata.live` (pas de nouvelle colonne/migration), modifiable
 * via le PATCH /layers/:id générique déjà existant (metadata est un `z.record(z.unknown())`
 * permissif). */
export class GetLiveLayerDataUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly liveLayerService: LiveLayerService,
  ) {}

  async execute(layerId: string): Promise<LiveLayerResult> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);

    const liveConfig = (layer.metadata as Record<string, unknown> | null)?.['live'];
    if (!isLiveLayerConfig(liveConfig)) {
      throw new ValidationError("Cette couche n'est pas configurée comme couche vivante.", {});
    }

    return this.liveLayerService.fetch(layerId, liveConfig);
  }
}
