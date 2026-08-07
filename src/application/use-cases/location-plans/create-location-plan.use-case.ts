import { v4 as uuidv4 } from 'uuid';
import { ILocationPlanRepository } from '../../../domain/repositories/location-plan.repository.js';
import {
  LocationPlan,
  LocationPlanElevationSummary,
  LocationPlanRouteLeg,
} from '../../../domain/entities/location-plan.entity.js';
import { CreateLocationPlanDTO } from '../../dtos/location-plan.dto.js';
import { JobStatus, PaperSize, PlanOrientation } from '../../../domain/enums.js';
import type { QueueService } from '../../../infrastructure/queue/queue.service.js';
import type { PrismaInstanceRepository } from '../../../infrastructure/database/repositories/prisma-instance.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import type { GeminiService } from '../../../infrastructure/external-apis/gemini.service.js';
import type { OSRMService } from '../../../infrastructure/external-apis/osrm.service.js';
import { logger } from '../../../infrastructure/observability/logger.js';

/** Au-delà de cette distance (mètres) entre le point réellement demandé et le point auquel
 * OSRM a dû accrocher l'itinéraire routier, on considère que la destination n'est pas
 * directement sur une route carrossable et qu'un tronçon à pied est nécessaire pour la
 * dernière portion - seuil empirique (largeur de parcelle/cour typique), pas une valeur
 * documentée par OSRM lui-même. */
const WALK_SEGMENT_THRESHOLD_METERS = 40;

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Concatène les coordonnées de plusieurs LineString GeoJSON en une seule (pour le drapage
 * altimétrique global du trajet) - ne fusionne pas les géométries spatialement, se contente
 * de mettre les tronçons bout à bout dans l'ordre où ils sont parcourus. */
function combineLineStrings(geometries: { coordinates: [number, number][] }[]): string {
  const coordinates = geometries.flatMap((g) => g.coordinates);
  return JSON.stringify({ type: 'LineString', coordinates });
}

function classifyTerrain(ascentMeters: number): LocationPlanElevationSummary['terrainClass'] {
  if (ascentMeters < 15) return 'plat';
  if (ascentMeters < 60) return 'vallonne';
  return 'accidente';
}

export interface AccessRouteResult {
  legs: LocationPlanRouteLeg[];
  elevation: LocationPlanElevationSummary | null;
  accessInstructions: string;
}

export class CreateLocationPlanUseCase {
  constructor(
    private readonly locationPlanRepository: ILocationPlanRepository,
    private readonly instanceRepository: PrismaInstanceRepository,
    private readonly queueService: QueueService,
    private readonly postGISService: PostGISService,
    private readonly geminiService: GeminiService,
    private readonly osrmService: OSRMService,
  ) {}

  /**
   * Rédige description/point de repère à partir des lieux OSM les plus proches (voir
   * PostGISService.findNearestPlaces) - bonus jamais bloquant : une clé Gemini
   * absente/un échec renvoie simplement null, le plan se crée normalement sans texte généré.
   */
  private async draftWithAI(
    lon: number,
    lat: number,
    title: string,
    lang = 'fr',
  ): Promise<{ description: string; landmark: string } | null> {
    try {
      const places = await this.postGISService.findNearestPlaces(lon, lat, 5);

      if (lang === 'en') {
        const context =
          places.length > 0
            ? places
                .map(
                  (p) =>
                    `${p.kind === 'place' ? 'Named place' : 'Landmark'} "${p.name}" about ${Math.round(p.distanceMeters)}m away`,
                )
                .join(', ')
            : 'No named place found nearby in the OpenStreetMap data.';
        const prompt =
          `You are writing the content of a location plan titled "${title}", ` +
          `located at coordinates ${lat.toFixed(6)}, ${lon.toFixed(6)}. Nearby OpenStreetMap context: ${context}. ` +
          `Answer STRICTLY in JSON, no surrounding text, in this format: ` +
          `{"description": "a descriptive sentence about the place", "landmark": "a short landmark, or empty string if none reliable"}`;
        const raw = await this.geminiService.generateText(prompt);
        const match = /\{[\s\S]*\}/.exec(raw);
        if (!match) return null;
        const parsed = JSON.parse(match[0]) as { description?: string; landmark?: string };
        return { description: parsed.description ?? '', landmark: parsed.landmark ?? '' };
      }

      const context =
        places.length > 0
          ? places
              .map(
                (p) =>
                  `${p.kind === 'place' ? 'Lieu-dit' : 'Repère'} "${p.name}" à environ ${Math.round(p.distanceMeters)}m`,
              )
              .join(', ')
          : 'Aucun lieu nommé trouvé à proximité dans les données OpenStreetMap.';

      const prompt =
        `Tu rédiges le contenu d'un plan de localisation cartographique intitulé "${title}", ` +
        `situé aux coordonnées ${lat.toFixed(6)}, ${lon.toFixed(6)}. Contexte OpenStreetMap à proximité : ${context}. ` +
        `Réponds STRICTEMENT en JSON, sans aucun texte autour, au format : ` +
        `{"description": "une phrase descriptive du lieu", "landmark": "un point de repère court ou chaîne vide si aucun repère fiable"}`;

      const raw = await this.geminiService.generateText(prompt);
      const match = /\{[\s\S]*\}/.exec(raw);
      if (!match) return null;
      const parsed = JSON.parse(match[0]) as { description?: string; landmark?: string };
      return { description: parsed.description ?? '', landmark: parsed.landmark ?? '' };
    } catch (error) {
      logger.warn('Rédaction IA du plan de localisation indisponible', {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  private static readonly MODE_LABELS: Record<string, { fr: string; en: string }> = {
    driving: { fr: 'en véhicule', en: 'by car' },
    walking: { fr: 'à pied', en: 'on foot' },
  };

  private static readonly TERRAIN_LABELS: Record<
    LocationPlanElevationSummary['terrainClass'],
    { fr: string; en: string }
  > = {
    plat: { fr: 'terrain plat', en: 'flat terrain' },
    vallonne: { fr: 'terrain légèrement vallonné', en: 'gently sloped terrain' },
    accidente: { fr: 'terrain accidenté', en: 'steep terrain' },
  };

  /** Phrase de repli déterministe (toujours disponible, ne dépend d'aucun appel externe) -
   * utilisée telle quelle si Gemini échoue/est indisponible, et comme donnée de base du
   * prompt IA sinon (l'IA reformule plutôt que d'inventer des chiffres). */
  private buildFallbackInstructions(
    legs: LocationPlanRouteLeg[],
    elevation: LocationPlanElevationSummary | null,
    lang: string,
  ): string {
    const isEn = lang === 'en';
    const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
    const fmtMin = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;
    const parts = legs.map((leg) => {
      const modeLabel = CreateLocationPlanUseCase.MODE_LABELS[leg.mode][isEn ? 'en' : 'fr'];
      return `${fmtMin(leg.durationSeconds)} ${modeLabel} (${fmtKm(leg.distanceMeters)})`;
    });
    const base = isEn
      ? `Access: about ${parts.join(', then ')}.`
      : `Accès : environ ${parts.join(', puis ')}.`;
    if (!elevation) return base;
    const terrainLabel = CreateLocationPlanUseCase.TERRAIN_LABELS[elevation.terrainClass][isEn ? 'en' : 'fr'];
    const elevationLabel = isEn ? 'Elevation gain along the way' : 'Dénivelé positif sur le trajet';
    return `${base} ${elevationLabel} : +${Math.round(elevation.ascentMeters)} m (${terrainLabel}).`;
  }

  /** Tronçon "véhicule" origine -> destination via OSRM, plus le tronçon "à pied" final si la
   * destination n'est pas directement accrochée à une route carrossable (voir
   * WALK_SEGMENT_THRESHOLD_METERS). Renvoie [] si OSRM ne trouve aucun itinéraire routier. */
  private async computeRouteLegs(
    originLon: number,
    originLat: number,
    destLon: number,
    destLat: number,
  ): Promise<LocationPlanRouteLeg[]> {
    const driveResult = await this.osrmService.route(
      [
        [originLon, originLat],
        [destLon, destLat],
      ],
      'driving',
      { geometries: 'geojson' },
    );
    if (driveResult.code !== 'Ok' || driveResult.routes.length === 0) return [];
    const driveRoute = driveResult.routes[0];
    const legs: LocationPlanRouteLeg[] = [
      {
        mode: 'driving',
        distanceMeters: driveRoute.distance,
        durationSeconds: driveRoute.duration,
        geometry: driveRoute.geometry,
      },
    ];

    const snappedDest = driveResult.waypoints[1]?.location;
    const gapMeters = snappedDest ? haversineMeters(snappedDest, [destLon, destLat]) : 0;
    if (!snappedDest || gapMeters <= WALK_SEGMENT_THRESHOLD_METERS) return legs;

    let walkGeometry: { type: string; coordinates: [number, number][] } = {
      type: 'LineString',
      coordinates: [snappedDest, [destLon, destLat]],
    };
    let walkDistance = gapMeters;
    let walkDuration = gapMeters / 1.2; // ~1.2 m/s, vitesse de marche moyenne - repli si OSRM foot échoue.
    try {
      const walkResult = await this.osrmService.route([snappedDest, [destLon, destLat]], 'walking', {
        geometries: 'geojson',
      });
      if (walkResult.code === 'Ok' && walkResult.routes.length > 0) {
        walkGeometry = walkResult.routes[0].geometry as typeof walkGeometry;
        walkDistance = walkResult.routes[0].distance;
        walkDuration = walkResult.routes[0].duration;
      }
    } catch {
      /* repli sur la ligne droite déjà préparée ci-dessus */
    }

    // OSRM peut accrocher les DEUX extrémités de la requête piéton au même nœud (réseau
    // piéton connu qui s'arrête avant la destination réelle) - le tracé renvoyé est alors
    // valide mais dégénéré (distance ~0, ne rejoint jamais le point réellement demandé). On
    // complète toujours par un segment droit jusqu'à la vraie destination : mieux vaut une
    // ligne droite honnête qu'un tracé qui s'arrête silencieusement trop tôt.
    const lastCoord = walkGeometry.coordinates.at(-1)!;
    const remainingGapMeters = haversineMeters(lastCoord, [destLon, destLat]);
    if (remainingGapMeters > 1) {
      walkGeometry = {
        type: 'LineString',
        coordinates: [...walkGeometry.coordinates, [destLon, destLat]],
      };
      walkDistance += remainingGapMeters;
      walkDuration += remainingGapMeters / 1.2;
    }

    legs.push({ mode: 'walking', distanceMeters: walkDistance, durationSeconds: walkDuration, geometry: walkGeometry });
    return legs;
  }

  /** Drape la géométrie combinée des tronçons sur le MNT SRTM - bonus non-bloquant, voir
   * PostGISService.drapeElevationProfile(). */
  private async computeElevationSummary(
    legs: LocationPlanRouteLeg[],
  ): Promise<LocationPlanElevationSummary | null> {
    try {
      const combinedGeojson = combineLineStrings(
        legs.map((l) => l.geometry as { coordinates: [number, number][] }),
      );
      const profile = await this.postGISService.drapeElevationProfile(combinedGeojson, 60);
      if (profile.length <= 1) return null;

      let ascent = 0;
      let descent = 0;
      let maxAltitude = profile[0].altitude;
      for (let i = 1; i < profile.length; i++) {
        const diff = profile[i].altitude - profile[i - 1].altitude;
        if (diff > 0) ascent += diff;
        else descent += -diff;
        if (profile[i].altitude > maxAltitude) maxAltitude = profile[i].altitude;
      }
      return {
        ascentMeters: ascent,
        descentMeters: descent,
        maxAltitudeMeters: maxAltitude,
        terrainClass: classifyTerrain(ascent),
      };
    } catch (error) {
      logger.warn('Drapage altimétrique du trajet indisponible', {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  /** Rédaction IA de la phrase d'accès à partir des chiffres réels déjà calculés (l'IA
   * reformule, elle n'invente aucune distance/durée) - repli déterministe garanti en cas
   * d'échec Gemini, voir buildFallbackInstructions(). */
  private async draftAccessInstructions(
    legs: LocationPlanRouteLeg[],
    elevation: LocationPlanElevationSummary | null,
    title: string,
    lang: string,
  ): Promise<string> {
    const fallback = this.buildFallbackInstructions(legs, elevation, lang);
    try {
      const legsDescription = legs
        .map(
          (l) =>
            `${l.mode === 'driving' ? 'véhicule' : 'marche'} : ${Math.round(l.distanceMeters)}m, ${Math.round(l.durationSeconds / 60)}min`,
        )
        .join(' puis ');
      const elevationDescription = elevation
        ? `Dénivelé positif cumulé sur le trajet : ${Math.round(elevation.ascentMeters)}m (terrain ${elevation.terrainClass}).`
        : '';
      const prompt =
        `Tu rédiges, pour un plan de localisation intitulé "${title}", une courte phrase (1-2 phrases maximum, ` +
        `${lang === 'en' ? 'in English' : 'en français'}) expliquant comment s'y rendre depuis le point de départ. ` +
        `Trajet réel calculé : ${legsDescription}. ${elevationDescription} ` +
        `Réponds uniquement avec la phrase finale, sans guillemets ni texte autour, ton pratique et concis (style plan d'accès).`;
      const raw = await this.geminiService.generateText(prompt);
      const cleaned = raw.trim().replace(/^["']|["']$/g, '');
      return cleaned || fallback;
    } catch (error) {
      logger.warn("Rédaction IA de l'itinéraire d'accès indisponible, repli déterministe utilisé", {
        error: error instanceof Error ? error.message : error,
      });
      return fallback;
    }
  }

  /** Calcule l'itinéraire d'accès (véhicule + éventuel dernier tronçon à pied), son drapage
   * altimétrique et une phrase d'accès rédigée par l'IA - bonus jamais bloquant pour la
   * création du plan : toute erreur (OSRM indisponible, point isolé du réseau routier...)
   * renvoie null et le plan se génère normalement, sans itinéraire d'accès. */
  private async computeAccessRoute(
    originLon: number,
    originLat: number,
    destLon: number,
    destLat: number,
    title: string,
    lang: string,
  ): Promise<AccessRouteResult | null> {
    try {
      const legs = await this.computeRouteLegs(originLon, originLat, destLon, destLat);
      if (legs.length === 0) return null;

      const elevation = await this.computeElevationSummary(legs);
      const accessInstructions = await this.draftAccessInstructions(legs, elevation, title, lang);

      return { legs, elevation, accessInstructions };
    } catch (error) {
      logger.warn("Calcul de l'itinéraire d'accès indisponible", {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  async execute(userId: string, dto: CreateLocationPlanDTO, lang = 'fr'): Promise<LocationPlan> {
    const instance = await this.instanceRepository.findById(dto.instanceId);
    if (!instance) throw new Error(`Instance ${dto.instanceId} not found`);

    let description = dto.description ?? null;
    let landmark = dto.landmark ?? null;
    if (dto.autoFillWithAI && (!description || !landmark)) {
      const drafted = await this.draftWithAI(dto.lon, dto.lat, dto.title, lang);
      if (drafted) {
        description = description ?? (drafted.description || null);
        landmark = landmark ?? (drafted.landmark || null);
      }
    }

    let accessRoute: AccessRouteResult | null = null;
    if (dto.originLon !== undefined && dto.originLat !== undefined) {
      accessRoute = await this.computeAccessRoute(
        dto.originLon,
        dto.originLat,
        dto.lon,
        dto.lat,
        dto.title,
        lang,
      );
    }

    const id = uuidv4();
    const record = await this.locationPlanRepository.create({
      id,
      userId,
      instanceId: dto.instanceId,
      status: JobStatus.PENDING,
      title: dto.title,
      description,
      landmark,
      lon: dto.lon,
      lat: dto.lat,
      scale: dto.scale ?? null,
      paperSize: dto.paperSize ?? PaperSize.A4,
      orientation: dto.orientation ?? PlanOrientation.PORTRAIT,
      includeLegend: dto.includeLegend ?? true,
      includeScale: dto.includeScale ?? true,
      includeGrid: dto.includeGrid ?? true,
      includeNorthArrow: dto.includeNorthArrow ?? true,
      originLon: dto.originLon ?? null,
      originLat: dto.originLat ?? null,
      accessInstructions: accessRoute?.accessInstructions ?? null,
      routeLegs: accessRoute?.legs ?? null,
      elevationSummary: accessRoute?.elevation ?? null,
      filePath: null,
      fileSize: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    await this.queueService.addJob('location-plan', 'generate', {
      locationPlanId: id,
      userId,
      lon: dto.lon,
      lat: dto.lat,
      title: dto.title,
      description: record.description ?? undefined,
      landmark: record.landmark ?? undefined,
      scale: dto.scale,
      paperSize: record.paperSize,
      orientation: record.orientation,
      includeLegend: record.includeLegend,
      includeScale: record.includeScale,
      includeGrid: record.includeGrid,
      includeNorthArrow: record.includeNorthArrow,
      instanceBbox: instance.bbox ?? null,
      originLon: record.originLon ?? undefined,
      originLat: record.originLat ?? undefined,
      accessInstructions: record.accessInstructions ?? undefined,
      routeLegs: record.routeLegs ?? undefined,
      elevationSummary: record.elevationSummary ?? undefined,
    });

    return record;
  }
}
