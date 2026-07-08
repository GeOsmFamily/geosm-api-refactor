import type { PrismaInstanceRepository } from '../../../infrastructure/database/repositories/prisma-instance.repository.js';
import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { ImportOsmDataUseCase } from './import-osm-data.use-case.js';
import type { ResyncLayerUseCase } from '../layers/resync-layer.use-case.js';
import { logger } from '../../../infrastructure/observability/logger.js';

export interface ScheduledOsmImportResult {
  imported: boolean;
  instancesProcessed: number;
  layersResynced: number;
  layersSkipped: number;
  layersFailed: number;
}

/**
 * Job planifié (voir QueueService.addRepeatableJob, enregistré dans server.ts) : ré-importe
 * périodiquement les données OSM brutes (osm.planet_osm_*, partagées par toutes les
 * instances) depuis un fichier .osm.pbf, puis resynchronise toutes les couches par défaut
 * dérivées d'OSM de toutes les instances actives (réutilise ResyncLayerUseCase, voir Lot 2).
 * Ne télécharge PAS le fichier .osm.pbf lui-même : ce chemin doit être déposé sur le disque
 * (ou monté en volume) par un mécanisme externe - voir OSM_IMPORT_PBF_PATH.
 */
export class ScheduledOsmImportUseCase {
  constructor(
    private readonly instanceRepository: PrismaInstanceRepository,
    private readonly layerRepository: ILayerRepository,
    private readonly importOsmDataUseCase: ImportOsmDataUseCase,
    private readonly resyncLayerUseCase: ResyncLayerUseCase,
    private readonly pbfPath: string | undefined,
  ) {}

  async execute(): Promise<ScheduledOsmImportResult> {
    const result: ScheduledOsmImportResult = {
      imported: false,
      instancesProcessed: 0,
      layersResynced: 0,
      layersSkipped: 0,
      layersFailed: 0,
    };

    if (!this.pbfPath) {
      logger.info('Import OSM programmé ignoré : OSM_IMPORT_PBF_PATH non configuré.');
      return result;
    }

    logger.info('Import OSM programmé démarré', { pbfPath: this.pbfPath });
    await this.importOsmDataUseCase.execute({ pbfPath: this.pbfPath, append: true });
    result.imported = true;

    const { data: instances } = await this.instanceRepository.findAll({
      isActive: true,
      limit: 1000,
    });
    result.instancesProcessed = instances.length;

    for (const instance of instances) {
      const { data: layers } = await this.layerRepository.findByInstance(instance.id, {
        limit: 1000,
      });
      for (const layer of layers) {
        try {
          await this.resyncLayerUseCase.execute(layer.id);
          result.layersResynced++;
        } catch (error) {
          // Les couches qui ne sont pas dérivées d'OSM par défaut (ex. couches importées
          // manuellement) rejettent volontairement la resynchronisation - ce n'est pas une
          // erreur à ce niveau, seulement à ignorer pour ce lot planifié.
          if (error instanceof Error && error.message.includes('resynchronisation impossible')) {
            result.layersSkipped++;
          } else {
            result.layersFailed++;
            logger.error(
              "Échec de la resynchronisation d'une couche pendant l'import OSM programmé",
              {
                layerId: layer.id,
                instanceId: instance.id,
                error: error instanceof Error ? error.message : error,
              },
            );
          }
        }
      }
    }

    logger.info('Import OSM programmé terminé', result);
    return result;
  }
}
