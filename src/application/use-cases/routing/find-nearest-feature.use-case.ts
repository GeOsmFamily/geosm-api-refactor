import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { OSRMService } from '../../../infrastructure/external-apis/osrm.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { logger } from '../../../infrastructure/observability/logger.js';

export interface NearestFeatureResult {
  id: string;
  name: string | null;
  lon: number;
  lat: number;
  distance: number; // mètres - routier si OSRM a répondu, sinon repli à vol d'oiseau
  duration: number | null; // secondes - null si repli à vol d'oiseau (pas de trajet OSRM)
  routed: boolean;
}

// Nombre de candidats pré-filtrés à vol d'oiseau (via l'index spatial, voir
// PostGISService.findNearestCandidates()) avant classement par distance routière réelle.
// Volontairement plus grand que la limite demandée : un point plus proche à vol d'oiseau
// peut être plus loin par la route (fleuve, absence de pont...) et inversement.
const CANDIDATE_POOL_SIZE = 10;

export class FindNearestFeatureUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
    private readonly osrmService: OSRMService,
  ) {}

  async execute(
    layerId: string,
    lon: number,
    lat: number,
    limit = 3,
  ): Promise<NearestFeatureResult[]> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', layerId);
    }

    const candidates = await this.postGISService.findNearestCandidates(
      layer.schemaName,
      layer.tableName,
      lon,
      lat,
      Math.max(CANDIDATE_POOL_SIZE, limit),
    );
    if (candidates.length === 0) return [];

    // Repli à vol d'oiseau par défaut - remplacé par les valeurs routières ci-dessous si
    // l'appel OSRM réussit. Le géoportail doit rester utilisable même si OSRM est
    // indisponible (comme le profil altimétrique reste utilisable sans MNT chargé).
    const fallback: NearestFeatureResult[] = candidates
      .sort((a, b) => a.straightDistance - b.straightDistance)
      .slice(0, limit)
      .map((c) => ({
        id: c.id,
        name: c.name,
        lon: c.lon,
        lat: c.lat,
        distance: c.straightDistance,
        duration: null,
        routed: false,
      }));

    try {
      const coordinates: [number, number][] = [
        [lon, lat],
        ...candidates.map((c) => [c.lon, c.lat] as [number, number]),
      ];
      const destinations = candidates.map((_, i) => i + 1);
      const table = await this.osrmService.table(coordinates, [0], destinations);

      const routedDistances = table.distances[0];
      const routedDurations = table.durations[0];

      const ranked = candidates
        .map((c, i) => ({
          id: c.id,
          name: c.name,
          lon: c.lon,
          lat: c.lat,
          distance: routedDistances[i] ?? c.straightDistance,
          duration: routedDurations[i] ?? null,
          routed: routedDistances[i] != null,
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      return ranked;
    } catch (err) {
      logger.warn(
        'OSRM table request failed, falling back to straight-line distance for nearest-feature search',
        { error: (err as Error).message },
      );
      return fallback;
    }
  }
}
