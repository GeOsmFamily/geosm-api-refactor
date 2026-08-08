import type { Job } from 'bullmq';
import { Prisma, type PrismaClient } from '@prisma/client';
import { logger } from '../../observability/logger.js';
import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import type { IBaseMapRepository } from '../../../domain/repositories/base-map.repository.js';
import { BaseMapType } from '../../../domain/enums.js';
import type {
  SummarizeViewportUseCase,
  LayerSummaryEntry,
} from '../../../application/use-cases/geoportail/summarize-viewport.use-case.js';
import { formatLayerForPrompt } from '../../../application/use-cases/geoportail/summarize-viewport.use-case.js';
import type { ReverseGeocodingUseCase } from '../../../application/use-cases/geocoding/reverse-geocoding.use-case.js';
import type { GeminiService } from '../../external-apis/gemini.service.js';
import type { ReportRendererService } from '../../pdf/report-renderer.service.js';
import { buildReportHtml, resolveZoneBbox } from '../../pdf/report-template.js';
import type { ZoneBasemapService, ZoneBasemapResult } from '../../pdf/zone-basemap.service.js';
import { localize } from '../../../application/utils/localize.js';

export interface AnalysisReportJobData {
  reportId: string;
  userId: string;
  instanceId: string;
  topic: string;
  layerIds: string[];
  extent?: [number, number, number, number];
  geometry?: Record<string, unknown>;
}

type AnalysisReportWorkerDeps = {
  prisma: PrismaClient;
  instanceRepository: IInstanceRepository;
  baseMapRepository: IBaseMapRepository;
  summarizeViewportUseCase: SummarizeViewportUseCase;
  reverseGeocodingUseCase: ReverseGeocodingUseCase;
  zoneBasemapService: ZoneBasemapService;
  geminiService: GeminiService;
  reportRendererService: ReportRendererService;
  storageService: {
    uploadFile: (key: string, data: Buffer, contentType?: string) => Promise<string>;
  };
  notificationService: { notifyUser: (userId: string, event: string, data: unknown) => void };
};

const SUPPORTED_BASEMAP_TYPES = new Set<string>([BaseMapType.XYZ, BaseMapType.WMS]);

/** Nom de lieu + fond de carte réel pour la section "Zone analysée" (voir report-template.ts) -
 * jamais bloquant : une erreur de géocodage ou de récupération du fond de carte ne doit jamais
 * faire échouer la génération du rapport, elle dégrade juste cette section (contour schématique
 * de secours, ou pas de nom de lieu affiché) - même philosophie que le repli Gemini ci-dessous. */
async function resolveZoneContext(
  deps: Pick<
    AnalysisReportWorkerDeps,
    'baseMapRepository' | 'reverseGeocodingUseCase' | 'zoneBasemapService'
  >,
  instanceId: string,
  bbox: [number, number, number, number],
  reportId: string,
): Promise<{
  placeName: string | null;
  basemap: ZoneBasemapResult | null;
  basemapAttribution: string | null;
}> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;

  let placeName: string | null = null;
  try {
    const result = await deps.reverseGeocodingUseCase.execute(centerLat, centerLon);
    placeName = result.display_name;
  } catch (error) {
    logger.warn('Géocodage inverse indisponible pour le rapport (nom de lieu omis)', {
      reportId,
      error: error instanceof Error ? error.message : error,
    });
  }

  let basemap: ZoneBasemapResult | null = null;
  let basemapAttribution: string | null = null;
  try {
    const instanceBasemaps = await deps.baseMapRepository.findByInstance(instanceId);
    const candidates =
      instanceBasemaps.length > 0 ? instanceBasemaps : await deps.baseMapRepository.findDefaults();
    const chosen = candidates.find((b) => SUPPORTED_BASEMAP_TYPES.has(b.type));
    if (chosen) {
      basemap = await deps.zoneBasemapService.fetchForZone(bbox, chosen);
      if (basemap) basemapAttribution = chosen.attribution;
    }
  } catch (error) {
    logger.warn('Fond de carte indisponible pour le rapport (contour schématique utilisé)', {
      reportId,
      error: error instanceof Error ? error.message : error,
    });
  }

  return { placeName, basemap, basemapAttribution };
}

/** Rapport plus long/structuré que la synthèse courte du chat (SummarizeViewportUseCase) -
 * même esprit "croiser les couches, pas les lister", mais avec des sections explicites
 * (contexte, méthode, résultats, conclusion) adaptées à un document PDF autonome plutôt qu'à
 * une bulle de chat. */
function buildReportPrompt(topic: string, perLayer: LayerSummaryEntry[]): string {
  const layerList = perLayer.map(formatLayerForPrompt).join('; ');
  return (
    `Rédige un rapport d'analyse géospatiale en français sur le sujet suivant : "${topic}". ` +
    `Données disponibles (couches actives sur la zone étudiée) : ${layerList}. ` +
    `Structure la réponse en 4 paragraphes séparés par une ligne vide, SANS titres ni puces ` +
    `(le gabarit du rapport ajoute déjà les titres de section) : ` +
    `(1) Contexte - présente brièvement la zone et les couches mobilisées. ` +
    `(2) Méthode - explique en une phrase comment les chiffres ont été obtenus (agrégation des ` +
    `couches sur la zone). ` +
    `(3) Résultats - détaille les chiffres clés et surtout CROISE les couches entre elles ` +
    `(ratios, comparaisons), ne te contente pas de les énumérer. ` +
    `(4) Conclusion - une ou deux phrases de synthèse actionnable pour un lecteur non technique ` +
    `(élu local, ONG). Reste strictement factuel : n'invente aucun chiffre absent des données ` +
    `fournies, et si une comparaison n'est pas calculable, dis-le plutôt que de l'inventer.`
  );
}

export function createAnalysisReportProcessor(deps: AnalysisReportWorkerDeps) {
  return async function processAnalysisReport(job: Job<AnalysisReportJobData>): Promise<void> {
    const { reportId, userId, instanceId, topic, layerIds, extent, geometry } = job.data;
    logger.info("Traitement du job de rapport d'analyse", { jobId: job.id, reportId, topic });

    try {
      await deps.prisma.analysisReport.update({
        where: { id: reportId },
        data: { status: 'PROCESSING' },
      });
      deps.notificationService.notifyUser(userId, 'analysis-report:progress', {
        reportId,
        status: 'PROCESSING',
        progress: 10,
      });

      const instance = await deps.instanceRepository.findById(instanceId);
      const instanceName = instance ? localize(instance.name, 'fr') : 'Instance';

      const summary = await deps.summarizeViewportUseCase.execute(layerIds, 'fr', extent, geometry);
      if (summary.perLayer.length === 0) {
        throw new Error('Aucune donnée disponible pour les couches sélectionnées');
      }
      deps.notificationService.notifyUser(userId, 'analysis-report:progress', {
        reportId,
        status: 'PROCESSING',
        progress: 40,
      });

      // Jamais bloquant : si Gemini échoue, le rapport part quand même avec la synthèse courte
      // déjà produite par SummarizeViewportUseCase plutôt que d'échouer entièrement.
      let narrative = summary.narrative ?? 'Synthèse indisponible.';
      try {
        narrative = await deps.geminiService.generateText(
          buildReportPrompt(topic, summary.perLayer),
        );
      } catch (error) {
        logger.warn(
          'Rédaction longue du rapport indisponible (Gemini), repli sur la synthèse courte',
          {
            reportId,
            error: error instanceof Error ? error.message : error,
          },
        );
      }
      deps.notificationService.notifyUser(userId, 'analysis-report:progress', {
        reportId,
        status: 'PROCESSING',
        progress: 70,
      });

      const bbox = resolveZoneBbox(extent, geometry);
      const { placeName, basemap, basemapAttribution } = bbox
        ? await resolveZoneContext(deps, instanceId, bbox, reportId)
        : { placeName: null, basemap: null, basemapAttribution: null };

      const html = buildReportHtml({
        topic,
        instanceName,
        generatedAt: new Date(),
        perLayer: summary.perLayer,
        narrative,
        extent,
        geometry,
        placeName,
        basemap,
        basemapAttribution,
      });
      const pdfBuffer = await deps.reportRendererService.renderHtmlToPdf(html);

      const minioKey = `analysis-reports/${reportId}/report.pdf`;
      await deps.storageService.uploadFile(minioKey, pdfBuffer, 'application/pdf');

      await deps.prisma.analysisReport.update({
        where: { id: reportId },
        data: {
          status: 'COMPLETED',
          resultJson: summary.perLayer as unknown as Prisma.InputJsonValue,
          filePath: minioKey,
          fileSize: pdfBuffer.length,
        },
      });
      deps.notificationService.notifyUser(userId, 'analysis-report:completed', {
        reportId,
        status: 'COMPLETED',
        filePath: minioKey,
        fileSize: pdfBuffer.length,
      });
      logger.info("Rapport d'analyse terminé", { jobId: job.id, reportId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Job de rapport d'analyse échoué", { jobId: job.id, reportId, error: message });
      await deps.prisma.analysisReport
        .update({ where: { id: reportId }, data: { status: 'FAILED', errorMessage: message } })
        .catch(() => undefined);
      deps.notificationService.notifyUser(userId, 'analysis-report:failed', {
        reportId,
        status: 'FAILED',
        error: message,
      });
      throw error;
    }
  };
}
