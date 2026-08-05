import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService, ZonalStat } from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

/**
 * Statistiques raster sur une géométrie arbitraire, en SYNCHRONE (pas de job BullMQ) - contexte
 * conversationnel (assistant IA), pas le flux "Statistiques par zone dessinée" du panneau
 * Statistiques (RunRasterAnalysisUseCase, asynchrone car peut porter sur un raster entier /
 * beaucoup de zones). Réutilise directement PostGISService.getZonalStats avec une seule "zone"
 * ad hoc, même principe que le mode 'custom' de raster-analysis.worker.ts.
 */
export class GetRasterStatsInGeometryUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(layerId: string, geometry: Record<string, unknown>): Promise<ZonalStat> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);

    const isRaster = layer.metadata?.['source'] === 'raster';
    if (!isRaster || !layer.schemaName || !layer.tableName) {
      throw new ValidationError("Cette couche n'est pas un raster analysable", {});
    }

    const [stat] = await this.postGISService.getZonalStats(layer.schemaName, layer.tableName, [
      { id: 0, name: 'Zone', geojson: JSON.stringify(geometry) },
    ]);
    return (
      stat ?? { zoneId: 0, zoneName: 'Zone', sum: null, mean: null, min: null, max: null, count: 0 }
    );
  }
}
