import type { FastifyRequest } from 'fastify';

/**
 * Extrait la langue préférée depuis l'en-tête Accept-Language (ex: "fr-FR,fr;q=0.9,en;q=0.8" -> "fr").
 * Centralise ce qui était dupliqué (avec une variante différente et plus grossière rien que sur
 * instance.routes.ts) dans 4 fichiers de routes différents.
 */
export function resolveLang(request: FastifyRequest, defaultLang = 'fr'): string {
  const acceptLang = request.headers['accept-language'];
  if (!acceptLang) return defaultLang;
  return acceptLang.split(',')[0].split('-')[0].trim().toLowerCase();
}
