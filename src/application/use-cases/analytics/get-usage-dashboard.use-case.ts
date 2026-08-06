import type { PrismaClient } from '@prisma/client';
import {
  PrismaAnalyticsRepository,
  DailyCount,
  ToolUsageCount,
} from '../../../infrastructure/database/repositories/prisma-analytics.repository.js';
import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { NotificationService } from '../../../infrastructure/websocket/notification.service.js';
import { localize } from '../../utils/localize.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetUsageDashboardUseCase');

/** Libellés lisibles pour les event_type connus (voir les 10 emplacements qui appellent déjà
 * AnalyticsService.trackEvent côté frontend, + assistant_tool_used ajouté côté backend) -
 * repli sur la valeur brute pour tout event_type futur non listé ici. */
const EVENT_LABELS: Record<string, string> = {
  layer_activated: 'Couche activée',
  layer_deactivated: 'Couche désactivée',
  search_performed: 'Recherche effectuée',
  comment_created: 'Commentaire ajouté',
  location_plan_created: 'Plan de localisation généré',
  assistant_message_sent: "Message envoyé à l'IA",
  map_composition_saved: 'Carte enregistrée',
  map_composition_loaded: 'Carte chargée',
  tool_opened: 'Outil ouvert',
  export_downloaded: 'Export téléchargé',
  location_plan_downloaded: 'Plan de localisation téléchargé',
  analysis_report_downloaded: "Rapport d'analyse téléchargé",
};

const DOWNLOAD_EVENT_TYPES = [
  'export_downloaded',
  'location_plan_downloaded',
  'analysis_report_downloaded',
];

export interface UsageDashboard {
  onlineNow: number;
  dailyEvents: DailyCount[];
  dailyActiveUsers: DailyCount[];
  featureUsage: { eventType: string; label: string; count: number }[];
  aiUsage: {
    messagesSent: number;
    toolUsage: ToolUsageCount[];
    reportsGenerated: number;
    conversationsStarted: number;
  };
  downloads: { eventType: string; label: string; count: number }[];
  topLayers: { layerId: string; name: string; count: number }[];
}

/**
 * Tableau de bord d'usage admin (voir plan du 2026-08-05) - assemble en un seul appel les
 * données déjà trackées (AnalyticsEvent) plutôt que d'inventer un système de métriques
 * séparé : mêmes event_type que ceux déjà envoyés par AnalyticsService.trackEvent côté
 * frontend (7 emplacements existants) + assistant_tool_used (nouveau, côté backend, voir
 * AssistantChatUseCase.executeDataTool) et les 3 event_type de téléchargement (nouveaux,
 * jobs-tray.component.ts).
 */
export class GetUsageDashboardUseCase {
  constructor(
    private readonly analyticsRepository: PrismaAnalyticsRepository,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaClient,
    private readonly layerRepository: ILayerRepository,
  ) {}

  async execute(instanceId: string | null, days: number, lang = 'fr'): Promise<UsageDashboard> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [dailyEvents, dailyActiveUsers, breakdown, toolUsage, topLayersRaw] = await Promise.all([
      this.analyticsRepository.getDailyCounts(instanceId, startDate),
      this.analyticsRepository.getDailyActiveUsers(instanceId, startDate),
      this.analyticsRepository.getEventBreakdown(instanceId, startDate),
      this.analyticsRepository.getToolUsageBreakdown(instanceId, startDate),
      // Le classement des couches les plus activées n'a de sens que rapporté à une instance
      // précise (catalogues différents d'une instance à l'autre) - vide en vue plateforme.
      instanceId
        ? this.analyticsRepository.getTopActivatedLayersForInstance(instanceId, 10)
        : Promise.resolve([]),
    ]);

    const messagesSent =
      breakdown.find((b) => b.eventType === 'assistant_message_sent')?.count ?? 0;

    const [reportsGenerated, conversationsStarted] = await Promise.all([
      this.prisma.analysisReport.count({
        where: { status: 'COMPLETED', createdAt: { gte: startDate } },
      }),
      this.prisma.assistantConversation.count({ where: { createdAt: { gte: startDate } } }),
    ]);

    const featureUsage = breakdown
      .filter(
        (b) => !DOWNLOAD_EVENT_TYPES.includes(b.eventType) && b.eventType !== 'assistant_tool_used',
      )
      .map((b) => ({
        eventType: b.eventType,
        label: EVENT_LABELS[b.eventType] ?? b.eventType,
        count: b.count,
      }));

    const downloads = DOWNLOAD_EVENT_TYPES.map((eventType) => ({
      eventType,
      label: EVENT_LABELS[eventType] ?? eventType,
      count: breakdown.find((b) => b.eventType === eventType)?.count ?? 0,
    }));

    const topLayers = await Promise.all(
      topLayersRaw.map(async (l) => {
        const layer = await this.layerRepository.findById(l.layerId);
        return {
          layerId: l.layerId,
          name: layer ? localize(layer.name, lang) : l.layerId,
          count: l.count,
        };
      }),
    );

    logger.debug('Usage dashboard retrieved', { instanceId, days });

    return {
      onlineNow: this.notificationService.getConnectedUserIds().length,
      dailyEvents,
      dailyActiveUsers,
      featureUsage,
      aiUsage: { messagesSent, toolUsage, reportsGenerated, conversationsStarted },
      downloads,
      topLayers,
    };
  }
}
