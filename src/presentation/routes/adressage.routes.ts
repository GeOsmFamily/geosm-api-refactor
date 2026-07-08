import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { GetAdresseUseCase } from '../../application/use-cases/adressage/get-adresse.use-case.js';
import { GetPositionUseCase } from '../../application/use-cases/adressage/get-position.use-case.js';
import { GetPointsUseCase } from '../../application/use-cases/adressage/get-points.use-case.js';
import { SearchAdresseUseCase } from '../../application/use-cases/adressage/search-adresse.use-case.js';
import { GetAdresseByClickUseCase } from '../../application/use-cases/adressage/get-adresse-by-click.use-case.js';
import { CodeUsageUseCase } from '../../application/use-cases/adressage/code-usage.use-case.js';
import { AdressageService } from '../../infrastructure/database/adressage.service.js';

function parseBody<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } };
  },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new ValidationError(
      'Validation failed',
      result.error?.format() as Record<string, unknown>,
    );
  return result.data as T;
}

const getAdresseSchema = z.object({
  shema: z.string().min(1),
  table: z.string().min(1),
  geom: z.string().min(1),
});

const getPositionSchema = z.object({ adresse: z.string().min(1) });

const getPointsSchema = z.object({
  coord: z.tuple([z.number(), z.number()]),
  nom_rue: z.string().min(1),
});

const searchAdresseSchema = z.object({ usage: z.string().min(1) });

const getAdresseByClickSchema = z.object({
  coord: z.tuple([z.number(), z.number()]),
});

const getElasticDataSchema = z.object({
  data: z.array(
    z.object({
      shema: z.string(),
      table: z.string(),
      key_couche: z.string(),
      id: z.number(),
    }),
  ),
});

export async function adressageRoutes(app: FastifyInstance): Promise<void> {
  const getAdresseUseCase = app.diContainer.resolve<GetAdresseUseCase>('getAdresseUseCase');
  const getPositionUseCase = app.diContainer.resolve<GetPositionUseCase>('getPositionUseCase');
  const getPointsUseCase = app.diContainer.resolve<GetPointsUseCase>('getPointsUseCase');
  const searchAdresseUseCase =
    app.diContainer.resolve<SearchAdresseUseCase>('searchAdresseUseCase');
  const getAdresseByClickUseCase = app.diContainer.resolve<GetAdresseByClickUseCase>(
    'getAdresseByClickUseCase',
  );
  const codeUsageUseCase = app.diContainer.resolve<CodeUsageUseCase>('codeUsageUseCase');
  const adressageService = app.diContainer.resolve<AdressageService>('adressageService');

  // POST /adressage/adresse
  app.post(
    '/adresse',
    {
      schema: {
        description: 'Obtenir une adresse',
        tags: ['Adressage'],
        body: zodToSwagger(getAdresseSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { shema, table, geom } = parseBody(getAdresseSchema, request.body);
      const result = await getAdresseUseCase.execute(shema, table, geom);
      return reply.send(successResponse(result));
    },
  );

  // POST /adressage/position
  app.post(
    '/position',
    {
      schema: {
        description: "Obtenir la position d'une adresse",
        tags: ['Adressage'],
        body: zodToSwagger(getPositionSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { adresse } = parseBody(getPositionSchema, request.body);
      const result = await getPositionUseCase.execute(adresse);
      return reply.send(successResponse(result));
    },
  );

  // POST /adressage/points
  app.post(
    '/points',
    {
      schema: {
        description: "Obtenir les points d'une rue",
        tags: ['Adressage'],
        body: zodToSwagger(getPointsSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { coord, nom_rue } = parseBody(getPointsSchema, request.body);
      const result = await getPointsUseCase.execute(coord, nom_rue);
      return reply.send(successResponse(result));
    },
  );

  // POST /adressage/search
  app.post(
    '/search',
    {
      schema: {
        description: 'Rechercher une adresse par usage',
        tags: ['Adressage'],
        body: zodToSwagger(searchAdresseSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { usage } = parseBody(searchAdresseSchema, request.body);
      const result = await searchAdresseUseCase.execute(usage);
      return reply.send(successResponse(result));
    },
  );

  // POST /adressage/click
  app.post(
    '/click',
    {
      schema: {
        description: "Obtenir l'adresse par clic sur la carte",
        tags: ['Adressage'],
        body: zodToSwagger(getAdresseByClickSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { coord } = parseBody(getAdresseByClickSchema, request.body);
      const result = await getAdresseByClickUseCase.execute(coord);
      return reply.send(successResponse({ adresse: result }));
    },
  );

  // GET /adressage/code-usage
  app.get(
    '/code-usage',
    {
      schema: { description: "Obtenir les codes d'usage", tags: ['Adressage'] },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await codeUsageUseCase.execute();
      return reply.send(successResponse(result));
    },
  );

  // POST /adressage/elastic-data
  app.post(
    '/elastic-data',
    {
      schema: {
        description: 'Obtenir les donnees Elasticsearch',
        tags: ['Adressage'],
        body: zodToSwagger(getElasticDataSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { data } = parseBody(getElasticDataSchema, request.body);
      const result = await adressageService.getElasticData(data);
      return reply.send(successResponse(result));
    },
  );
}
