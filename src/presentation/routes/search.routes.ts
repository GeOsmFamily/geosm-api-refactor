import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { globalSearchQuerySchema, searchLayersQuerySchema, searchFeaturesQuerySchema, searchSuggestionsQuerySchema, layerRecommendationsQuerySchema } from '../schemas/search.schema.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import type { GlobalSearchUseCase } from '../../application/use-cases/search/global-search.use-case.js';
import type { SearchLayersUseCase } from '../../application/use-cases/search/search-layers.use-case.js';
import type { SearchFeaturesUseCase } from '../../application/use-cases/search/search-features.use-case.js';
import type { GetSearchSuggestionsUseCase } from '../../application/use-cases/search/get-search-suggestions.use-case.js';
import type { GetLayerRecommendationsUseCase } from '../../application/use-cases/search/get-layer-recommendations.use-case.js';
import { resolveLang } from '../utils/lang.util.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  const globalSearchUseCase = app.diContainer.resolve<GlobalSearchUseCase>('globalSearchUseCase');
  const searchLayersUseCase = app.diContainer.resolve<SearchLayersUseCase>('searchLayersUseCase');
  const searchFeaturesUseCase = app.diContainer.resolve<SearchFeaturesUseCase>('searchFeaturesUseCase');
  const getSearchSuggestionsUseCase = app.diContainer.resolve<GetSearchSuggestionsUseCase>('getSearchSuggestionsUseCase');
  const getLayerRecommendationsUseCase = app.diContainer.resolve<GetLayerRecommendationsUseCase>('getLayerRecommendationsUseCase');

  app.get('/', {
    schema: { description: 'Recherche globale', tags: ['Recherche'], querystring: zodToSwagger(globalSearchQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(globalSearchQuerySchema, request.query);
    const result = await globalSearchUseCase.execute(query.q, query.limit, resolveLang(request));
    return reply.send(successResponse(result));
  });

  app.get('/layers', {
    schema: { description: 'Rechercher des couches', tags: ['Recherche'], querystring: zodToSwagger(searchLayersQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(searchLayersQuerySchema, request.query);
    const result = await searchLayersUseCase.execute(query.q, {
      instanceId: query.instanceId,
      limit: query.limit,
      offset: query.offset,
      lang: resolveLang(request),
    });
    return reply.send(successResponse(result));
  });

  app.get('/features', {
    schema: { description: 'Rechercher des entites geographiques', tags: ['Recherche'], querystring: zodToSwagger(searchFeaturesQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(searchFeaturesQuerySchema, request.query);
    const result = await searchFeaturesUseCase.execute(query.q, {
      layerId: query.layerId,
      limit: query.limit,
      offset: query.offset,
    });
    return reply.send(successResponse(result));
  });

  // GET /search/suggestions?instanceId=&limit= — suggestions contextuelles (v1 déterministe,
  // classement par fréquence d'activation passée, pas d'appel Gemini par frappe clavier).
  // Auth optionnelle : sans utilisateur connu, repli direct sur les couches tendance de
  // l'instance (voir GetSearchSuggestionsUseCase).
  app.get('/suggestions', {
    schema: { description: 'Suggestions de recherche contextuelles', tags: ['Recherche'], querystring: zodToSwagger(searchSuggestionsQuerySchema) },
    preHandler: [app.authenticateOptional],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(searchSuggestionsQuerySchema, request.query);
    const userId = (request.user as { sub: string } | undefined)?.sub;
    const acceptLang = request.headers['accept-language'];
    const lang = acceptLang ? acceptLang.split(',')[0].split('-')[0].trim().toLowerCase() : 'fr';
    const result = await getSearchSuggestionsUseCase.execute(userId, query.instanceId, query.limit, lang);
    return reply.send(successResponse(result));
  });

  // GET /search/layer-recommendations?layerId=&instanceId=&limit= — "les utilisateurs qui
  // ont activé X ont aussi activé Y" (co-occurrence, voir GetLayerRecommendationsUseCase).
  app.get('/layer-recommendations', {
    schema: { description: 'Recommandation de couches par co-occurrence', tags: ['Recherche'], querystring: zodToSwagger(layerRecommendationsQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(layerRecommendationsQuerySchema, request.query);
    const acceptLang = request.headers['accept-language'];
    const lang = acceptLang ? acceptLang.split(',')[0].split('-')[0].trim().toLowerCase() : 'fr';
    const result = await getLayerRecommendationsUseCase.execute(query.layerId, query.instanceId, query.limit, lang);
    return reply.send(successResponse(result));
  });
}
