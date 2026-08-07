import type { Job } from 'bullmq';
import { Prisma, type PrismaClient } from '@prisma/client';
import { logger } from '../../observability/logger.js';
import type { PostGISService, RasterStats, ZonalStat } from '../../database/postgis.service.js';
import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { FindAdminBoundariesByLevelUseCase } from '../../../application/use-cases/geoportail/find-admin-boundaries-by-level.use-case.js';
import type { GeminiService } from '../../external-apis/gemini.service.js';

type RasterAnalysisWorkerDeps = {
  prisma: PrismaClient;
  postGISService: PostGISService;
  layerRepository: ILayerRepository;
  findAdminBoundariesByLevelUseCase: FindAdminBoundariesByLevelUseCase;
  geminiService: GeminiService;
};

interface RasterAnalysisJobData {
  resultId: string;
  layerId: string;
  type: 'global' | 'zonal' | 'custom';
  instanceId: string;
  adminLevel?: number;
  geometry?: Record<string, unknown>;
}

/** Prompt-builder "conclusif" pour les stats raster - même logique que le prompt comparatif des
 * stats vectorielles (voir GetLayerStatsUseCase) : ne pas se contenter d'énumérer les chiffres,
 * situer/conclure (dispersion, zone la plus/moins marquée...), voir plan "refonte Statistiques"
 * du 2026-08-05. Pas de comparaison "zone vs ensemble" possible ici comme côté vectoriel (un
 * raster global EST déjà l'ensemble ; un raster zonal EST déjà une comparaison entre zones) -
 * la conclusion porte donc sur la dispersion/disparité plutôt que sur une proportion.
 */
function buildGlobalNarrativePrompt(layerName: string, stats: RasterStats): string {
  return (
    `Tu analyses le raster "${layerName}" sur un géoportail. Statistiques globales : ` +
    `min ${stats.min ?? 'n/d'}, max ${stats.max ?? 'n/d'}, moyenne ${stats.mean?.toFixed(2) ?? 'n/d'}, ` +
    `écart-type ${stats.stddev?.toFixed(2) ?? 'n/d'} (sur ${stats.count} cellules valides). ` +
    `Rédige une phrase concise et naturelle (en français, sans jargon, pour un géoportail public) ` +
    `qui conclut sur la dispersion des valeurs (homogène ou très variable selon l'écart-type ` +
    `relatif à la moyenne) plutôt que de répéter les chiffres.`
  );
}

function buildZonalNarrativePrompt(layerName: string, stats: ZonalStat[]): string {
  const sorted = [...stats].sort((a, b) => (b.sum ?? 0) - (a.sum ?? 0));
  const top = sorted[0];
  const bottom = sorted.at(-1);
  const zonesSummary = sorted
    .slice(0, 8)
    .map((z) => `${z.zoneName}: ${z.sum?.toFixed(0) ?? 'n/d'}`)
    .join(', ');
  return (
    `Tu analyses le raster "${layerName}" sur un géoportail, agrégé par zone : ${zonesSummary}` +
    (sorted.length > 8 ? `, et ${sorted.length - 8} autres zones` : '') +
    `. Zone la plus élevée : ${top?.zoneName} (${top?.sum?.toFixed(0) ?? 'n/d'}), zone la plus ` +
    `faible : ${bottom?.zoneName} (${bottom?.sum?.toFixed(0) ?? 'n/d'}). ` +
    `Rédige une phrase concise et naturelle (en français, sans jargon, pour un géoportail public) ` +
    `qui conclut sur la disparité entre zones (répartition homogène ou très inégale), en ` +
    `nommant la zone la plus marquée, plutôt que d'énumérer chaque zone.`
  );
}

/** Jamais bloquant - une clé Gemini absente/un quota dépassé ne doit pas faire échouer une
 * analyse raster qui fonctionnait déjà sans IA (même principe que GetLayerStatsUseCase). */
async function generateNarrative(
  geminiService: GeminiService,
  layerName: string,
  type: 'global' | 'zonal' | 'custom',
  result: RasterStats | ZonalStat[],
): Promise<string | null> {
  try {
    const prompt =
      type === 'global'
        ? buildGlobalNarrativePrompt(layerName, result as RasterStats)
        : buildZonalNarrativePrompt(layerName, result as ZonalStat[]);
    return await geminiService.generateText(prompt);
  } catch (error) {
    logger.warn("Synthèse narrative de l'analyse raster indisponible (Gemini)", {
      layerName,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

export function createRasterAnalysisProcessor(deps: RasterAnalysisWorkerDeps) {
  return async function processRasterAnalysis(job: Job): Promise<void> {
    const { resultId, layerId, type, instanceId, adminLevel, geometry } =
      job.data as RasterAnalysisJobData;
    logger.info("Traitement du job d'analyse raster", { jobId: job.id, resultId, type });

    try {
      await deps.prisma.rasterAnalysisResult.update({
        where: { id: resultId },
        data: { status: 'PROCESSING' },
      });

      const layer = await deps.layerRepository.findById(layerId);
      if (!layer || !layer.schemaName || !layer.tableName) {
        throw new Error('Layer introuvable ou sans table raster associée');
      }

      let result: unknown;
      if (type === 'global') {
        result = await deps.postGISService.getRasterStats(layer.schemaName, layer.tableName);
      } else if (type === 'custom') {
        // Zone unique dessinée à la main sur la carte (pas une admin_boundaries) - voir
        // statistics-tool.component.ts, réutilise getZonalStats avec une seule "zone" ad hoc.
        if (!geometry) throw new Error("Géométrie manquante pour une analyse de type 'custom'");
        result = await deps.postGISService.getZonalStats(layer.schemaName, layer.tableName, [
          { id: 0, name: 'Zone dessinée', geojson: JSON.stringify(geometry) },
        ]);
      } else {
        const zones = await deps.findAdminBoundariesByLevelUseCase.execute(instanceId, adminLevel);
        result = await deps.postGISService.getZonalStats(
          layer.schemaName,
          layer.tableName,
          zones.map((z) => ({ id: z.id, name: z.name, geojson: JSON.stringify(z.geojson) })),
        );
      }

      const narrative = await generateNarrative(
        deps.geminiService,
        layer.name,
        type,
        result as RasterStats | ZonalStat[],
      );

      await deps.prisma.rasterAnalysisResult.update({
        where: { id: resultId },
        data: { status: 'COMPLETED', result: result as Prisma.InputJsonValue, narrative },
      });
      logger.info("Job d'analyse raster terminé", { jobId: job.id, resultId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Job d'analyse raster échoué", { jobId: job.id, resultId, error: message });
      await deps.prisma.rasterAnalysisResult
        .update({ where: { id: resultId }, data: { status: 'FAILED', error: message } })
        .catch(() => undefined);
      throw error;
    }
  };
}
