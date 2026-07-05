import type { PrismaInstanceRepository } from '../../../infrastructure/database/repositories/prisma-instance.repository.js';
import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { IndexLayerUseCase } from './index-layer.use-case.js';
import type { MeiliSearchService } from '../../../infrastructure/external-apis/meilisearch.service.js';
import { logger } from '../../../infrastructure/observability/logger.js';

/**
 * Réindexe toutes les couches de toutes les instances dans MeiliSearch (index "layers").
 * Utile en rattrapage : IndexLayerUseCase n'est déclenché qu'à la création/modification
 * d'une couche (create-layer.use-case.ts, update-layer.use-case.ts) - si l'index MeiliSearch
 * a été recréé/vidé, ou si des couches ont été insérées par un autre chemin (bootstrap
 * d'instance, script), elles restent invisibles à la recherche tant qu'un rattrapage
 * explicite comme celui-ci n'est pas exécuté.
 */
export class ReindexAllLayersUseCase {
  constructor(
    private readonly instanceRepository: PrismaInstanceRepository,
    private readonly layerRepository: ILayerRepository,
    private readonly indexLayerUseCase: IndexLayerUseCase,
    private readonly meiliSearchService: MeiliSearchService,
  ) {}

  async execute(): Promise<{ instancesProcessed: number; layersIndexed: number; layersFailed: number }> {
    // Doit précéder l'indexation : addDocuments seul crée l'index sans attribut filtrable,
    // et toute recherche avec `filter: instanceId = "..."` échouerait ensuite en Bad Request.
    await this.meiliSearchService.updateFilterableAttributes('layers', ['instanceId']);

    const { data: instances } = await this.instanceRepository.findAll({ limit: 1000 });
    let layersIndexed = 0;
    let layersFailed = 0;

    for (const instance of instances) {
      const { data: layers } = await this.layerRepository.findByInstance(instance.id, { limit: 1000 });
      for (const layer of layers) {
        try {
          await this.indexLayerUseCase.execute(layer);
          layersIndexed++;
        } catch (error) {
          layersFailed++;
          logger.error('Échec de la réindexation d\'une couche', {
            layerId: layer.id, error: error instanceof Error ? error.message : error,
          });
        }
      }
    }

    return { instancesProcessed: instances.length, layersIndexed, layersFailed };
  }
}
