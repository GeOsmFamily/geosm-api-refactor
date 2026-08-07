import type { OSRMService } from '../../../infrastructure/external-apis/osrm.service.js';
import { logger } from '../../../infrastructure/observability/logger.js';

export interface IsochronePoint {
  lon: number;
  lat: number;
  durationSeconds: number;
}

// Vitesse "réseau libre" plausible par profil, utilisée UNIQUEMENT pour dimensionner l'étendue
// de la grille de points candidats (un majorant volontairement généreux - la vraie durée
// routée par OSRM, toujours plus grande sur un vrai réseau, filtre ensuite les points hors
// budget). Pas de profil de routage réel n'atteint ces vitesses partout, ce n'est pas un
// paramètre de précision de l'isochrone elle-même.
const MAX_SPEED_KMH: Record<string, number> = {
  driving: 100,
  cycling: 25,
  walking: 6,
};
const GRID_SIZE = 11; // 11x11 = 121 points candidats + l'origine, sous la limite max-table-size (1000)

/**
 * Approxime une isochrone (zone atteignable en un temps donné) sans dépendre d'un endpoint
 * OSRM dédié (aucun n'existe) ni de pgRouting (non installé) : échantillonne une grille de
 * points candidats autour de l'origine, dimensionnée par une vitesse plafond par profil, puis
 * interroge OSRM table() en un seul appel (origine → tous les candidats) pour obtenir les
 * VRAIES durées routées. Ne retourne que les points atteignables dans le budget - c'est
 * l'appelant (frontend, `@turf/turf`) qui calcule l'enveloppe (concave hull) à partir de ce
 * nuage de points, voir plan "Itinéraires : altimétrie, isochrones, multimodal" du 2026-08-06.
 */
export class GetIsochroneUseCase {
  constructor(private readonly osrmService: OSRMService) {}

  async execute(
    lon: number,
    lat: number,
    profile: string,
    minutes: number,
  ): Promise<IsochronePoint[]> {
    const speedKmh = MAX_SPEED_KMH[profile] ?? MAX_SPEED_KMH['driving'];
    const budgetSeconds = minutes * 60;
    const radiusKm = (speedKmh * minutes) / 60;

    const latDeltaPerKm = 1 / 111.32;
    // Correction en cos(latitude) : un degré de longitude couvre une distance au sol plus
    // courte en s'éloignant de l'équateur - sans cette correction la grille serait étirée
    // est-ouest de façon croissante avec la latitude.
    const lonDeltaPerKm = 1 / (111.32 * Math.cos((lat * Math.PI) / 180) || 1);

    const candidates: [number, number][] = [[lon, lat]];
    const half = Math.floor(GRID_SIZE / 2);
    for (let i = -half; i <= half; i++) {
      for (let j = -half; j <= half; j++) {
        if (i === 0 && j === 0) continue;
        const dLat = (i / half) * radiusKm * latDeltaPerKm;
        const dLon = (j / half) * radiusKm * lonDeltaPerKm;
        candidates.push([lon + dLon, lat + dLat]);
      }
    }

    try {
      const destinations = candidates.map((_, idx) => idx).slice(1);
      const table = await this.osrmService.table(candidates, [0], destinations, profile);
      const durations = table.durations[0];

      const points: IsochronePoint[] = [];
      for (let k = 0; k < destinations.length; k++) {
        const duration = durations[k];
        if (duration == null || duration > budgetSeconds) continue;
        const [candLon, candLat] = candidates[destinations[k]];
        points.push({ lon: candLon, lat: candLat, durationSeconds: duration });
      }
      // L'origine est toujours atteignable en 0s - nécessaire pour que l'enveloppe calculée
      // côté client inclue bien le point de départ.
      points.push({ lon, lat, durationSeconds: 0 });
      return points;
    } catch (error) {
      logger.warn('Isochrone indisponible (OSRM table)', {
        lon,
        lat,
        profile,
        minutes,
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }
}
