import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { apiErrorsTotal } from '../../../infrastructure/observability/metrics.js';

const logger = createChildLogger('FrontendError');

export interface LogFrontendErrorDTO {
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
}

/**
 * Remonte les erreurs JS non gérées côté frontend (voir GlobalErrorHandler Angular) - jusqu'ici
 * une erreur frontend restait invisible en dehors de la console du navigateur du visiteur,
 * sans aucune remontée dans Graylog/Prometheus.
 */
export class LogFrontendErrorUseCase {
  execute(dto: LogFrontendErrorDTO, userId: string | undefined): void {
    apiErrorsTotal.inc({ error_type: 'frontend' });
    logger.error('Unhandled frontend error', {
      message: dto.message,
      stack: dto.stack,
      url: dto.url,
      userAgent: dto.userAgent,
      userId,
    });
  }
}
