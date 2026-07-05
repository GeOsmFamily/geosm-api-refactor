import { v4 as uuidv4 } from 'uuid';
import { ILocationPlanRepository } from '../../../domain/repositories/location-plan.repository.js';
import { LocationPlan } from '../../../domain/entities/location-plan.entity.js';
import { CreateLocationPlanDTO } from '../../dtos/location-plan.dto.js';
import { JobStatus, PaperSize, PlanOrientation } from '../../../domain/enums.js';
import type { QueueService } from '../../../infrastructure/queue/queue.service.js';
import type { PrismaInstanceRepository } from '../../../infrastructure/database/repositories/prisma-instance.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import type { GeminiService } from '../../../infrastructure/external-apis/gemini.service.js';
import { logger } from '../../../infrastructure/observability/logger.js';

export class CreateLocationPlanUseCase {
  constructor(
    private readonly locationPlanRepository: ILocationPlanRepository,
    private readonly instanceRepository: PrismaInstanceRepository,
    private readonly queueService: QueueService,
    private readonly postGISService: PostGISService,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Rédige description/point de repère à partir des lieux OSM les plus proches (voir
   * PostGISService.findNearestPlaces) - bonus jamais bloquant : une clé Gemini
   * absente/un échec renvoie simplement null, le plan se crée normalement sans texte généré.
   */
  private async draftWithAI(lon: number, lat: number, title: string): Promise<{ description: string; landmark: string } | null> {
    try {
      const places = await this.postGISService.findNearestPlaces(lon, lat, 5);
      const context = places.length > 0
        ? places.map((p) => `${p.kind === 'place' ? 'Lieu-dit' : 'Repère'} "${p.name}" à environ ${Math.round(p.distanceMeters)}m`).join(', ')
        : 'Aucun lieu nommé trouvé à proximité dans les données OpenStreetMap.';

      const prompt = `Tu rédiges le contenu d'un plan de localisation cartographique intitulé "${title}", `
        + `situé aux coordonnées ${lat.toFixed(6)}, ${lon.toFixed(6)}. Contexte OpenStreetMap à proximité : ${context}. `
        + `Réponds STRICTEMENT en JSON, sans aucun texte autour, au format : `
        + `{"description": "une phrase descriptive du lieu", "landmark": "un point de repère court ou chaîne vide si aucun repère fiable"}`;

      const raw = await this.geminiService.generateText(prompt);
      const match = /\{[\s\S]*\}/.exec(raw);
      if (!match) return null;
      const parsed = JSON.parse(match[0]) as { description?: string; landmark?: string };
      return { description: parsed.description ?? '', landmark: parsed.landmark ?? '' };
    } catch (error) {
      logger.warn('Rédaction IA du plan de localisation indisponible', { error: error instanceof Error ? error.message : error });
      return null;
    }
  }

  async execute(userId: string, dto: CreateLocationPlanDTO): Promise<LocationPlan> {
    const instance = await this.instanceRepository.findById(dto.instanceId);
    if (!instance) throw new Error(`Instance ${dto.instanceId} not found`);

    let description = dto.description ?? null;
    let landmark = dto.landmark ?? null;
    if (dto.autoFillWithAI && (!description || !landmark)) {
      const drafted = await this.draftWithAI(dto.lon, dto.lat, dto.title);
      if (drafted) {
        description = description ?? (drafted.description || null);
        landmark = landmark ?? (drafted.landmark || null);
      }
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
    });

    return record;
  }
}
