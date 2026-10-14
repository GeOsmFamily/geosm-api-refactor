import { SpanStatusCode, trace } from '@opentelemetry/api';
import client from 'prom-client';
import { metricsRegister } from './metrics.js';

/**
 * Conventions d'observabilite des domaines sociaux de GeOsm Family (voir docs/v2/observability.md).
 *
 * - Logs   : tout evenement metier porte `event`, `requestId`, `userId` et `instanceId`.
 * - Metriques : prefixe `geosm_social_`, premier label `instance_id`.
 * - Traces : un span par use case, nomme `usecase.<NomDuUseCase>`.
 */

export interface SocialContext {
  requestId?: string | null;
  userId?: string | null;
  instanceId?: string | null;
}

/** Sous-ensemble de winston.Logger necessaire ici (facilite les tests). */
export interface StructuredLogger {
  debug(message: string, meta?: Record<string, unknown>): unknown;
  info(message: string, meta?: Record<string, unknown>): unknown;
  warn(message: string, meta?: Record<string, unknown>): unknown;
  error(message: string, meta?: Record<string, unknown>): unknown;
}

const EVENT_NAME = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/;
const METRIC_SUFFIX = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

/** `post.created`, `group.member_joined`, `event.registration_waitlisted`... */
export function assertEventName(event: string): void {
  if (!EVENT_NAME.test(event)) {
    throw new TypeError(
      `Nom d'evenement invalide "${event}" : attendu <domaine>.<action> en minuscules (ex. post.created)`,
    );
  }
}

/**
 * Journalise un evenement metier avec les quatre champs obligatoires. Les champs fournis dans
 * `extra` ne peuvent pas ecraser `event`, `requestId`, `userId` ni `instanceId`.
 */
export function logSocialEvent(
  log: StructuredLogger,
  level: 'debug' | 'info' | 'warn' | 'error',
  event: string,
  ctx: SocialContext,
  extra: Record<string, unknown> = {},
): void {
  assertEventName(event);
  log[level](event, {
    ...extra,
    event,
    requestId: ctx.requestId ?? null,
    userId: ctx.userId ?? null,
    instanceId: ctx.instanceId ?? null,
  });
}

const PREFIX = 'geosm_social_';
const metricCache = new Map<string, client.Counter<string> | client.Histogram<string>>();

function fullName(suffix: string): string {
  if (!METRIC_SUFFIX.test(suffix)) {
    throw new TypeError(`Nom de metrique invalide "${suffix}" : snake_case attendu, sans prefixe`);
  }
  return `${PREFIX}${suffix}`;
}

/** Compteur `geosm_social_<name>` ; `instance_id` est toujours le premier label. */
export function createSocialCounter(
  name: string,
  help: string,
  labelNames: string[] = [],
): client.Counter<string> {
  const metricName = fullName(name);
  if (!metricName.endsWith('_total')) {
    throw new TypeError(`Un compteur doit se terminer par _total : "${metricName}"`);
  }
  const cached = metricCache.get(metricName);
  if (cached) return cached as client.Counter<string>;
  const counter = new client.Counter({
    name: metricName,
    help,
    labelNames: ['instance_id', ...labelNames],
    registers: [metricsRegister],
  });
  metricCache.set(metricName, counter);
  return counter;
}

/** Histogramme de duree `geosm_social_<name>` (secondes), `instance_id` en premier label. */
export function createSocialHistogram(
  name: string,
  help: string,
  labelNames: string[] = [],
  buckets: number[] = [0.005, 0.015, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
): client.Histogram<string> {
  const metricName = fullName(name);
  if (!metricName.endsWith('_seconds')) {
    throw new TypeError(`Un histogramme de duree doit se terminer par _seconds : "${metricName}"`);
  }
  const cached = metricCache.get(metricName);
  if (cached) return cached as client.Histogram<string>;
  const histogram = new client.Histogram({
    name: metricName,
    help,
    labelNames: ['instance_id', ...labelNames],
    buckets,
    registers: [metricsRegister],
  });
  metricCache.set(metricName, histogram);
  return histogram;
}

const tracer = trace.getTracer('geosm-social');

/** Execute `fn` dans un span `usecase.<useCase>` portant `instance.id` et `user.id`. */
export async function withUseCaseSpan<T>(
  useCase: string,
  ctx: SocialContext,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(`usecase.${useCase}`, async (span) => {
    if (ctx.instanceId) span.setAttribute('instance.id', ctx.instanceId);
    if (ctx.userId) span.setAttribute('user.id', ctx.userId);
    try {
      return await fn();
    } catch (error) {
      span.recordException(error instanceof Error ? error : String(error));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
