import type { GetStaleLayersUseCase } from './get-stale-layers.use-case.js';
import type { IEmailService } from '../../services/email.service.js';
import { logger } from '../../../infrastructure/observability/logger.js';

const CUTOFF_DAYS = 90;

/**
 * Job planifié (queue `layer-freshness-report`, voir server.ts) : envoie un résumé email des
 * couches non resynchronisées depuis CUTOFF_DAYS jours (voir GetStaleLayersUseCase pour le
 * détail de fiabilité du signal `updatedAt`). Réutilise `sendAlertEmail` (sujet/corps déjà
 * formés par l'appelant, voir AlertingService) plutôt qu'un nouveau template SMTP dédié - même
 * volume de contenu qu'une alerte. N'envoie rien s'il n'y a aucune couche périmée, pour éviter un
 * email hebdomadaire vide.
 */
export class SendLayerFreshnessReportUseCase {
  constructor(
    private readonly getStaleLayersUseCase: GetStaleLayersUseCase,
    private readonly emailService: IEmailService,
    private readonly recipientEmail: string,
  ) {}

  async execute(): Promise<{ staleCount: number; emailSent: boolean }> {
    const staleLayers = await this.getStaleLayersUseCase.execute(CUTOFF_DAYS);
    if (staleLayers.length === 0) {
      return { staleCount: 0, emailSent: false };
    }
    if (!this.recipientEmail) {
      logger.warn('Rapport de fraîcheur des couches ignoré : aucun destinataire configuré');
      return { staleCount: staleLayers.length, emailSent: false };
    }

    const rows = staleLayers
      .slice(0, 50)
      .map(
        (l) =>
          `<tr><td>${l.name}</td><td>${l.instanceName}</td><td>${l.daysSinceUpdate} j</td></tr>`,
      )
      .join('');
    const html =
      `<h2>Rapport de fraîcheur des couches</h2>` +
      `<p>${staleLayers.length} couche(s) non resynchronisée(s) depuis plus de ${CUTOFF_DAYS} jours.</p>` +
      `<table border="1" cellpadding="6" cellspacing="0">` +
      `<tr><th>Couche</th><th>Instance</th><th>Dernière mise à jour</th></tr>${rows}</table>` +
      (staleLayers.length > 50
        ? `<p><small>Liste tronquée aux 50 plus anciennes.</small></p>`
        : '');

    await this.emailService.sendAlertEmail(
      this.recipientEmail,
      `[GeOsm] ${staleLayers.length} couche(s) potentiellement périmée(s)`,
      html,
    );
    logger.info('Rapport de fraîcheur des couches envoyé', { staleCount: staleLayers.length });
    return { staleCount: staleLayers.length, emailSent: true };
  }
}
