import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { GetSeoMetadataUseCase } from '../../application/use-cases/seo/get-seo-metadata.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const instanceSlugParamSchema = z.object({ instanceSlug: z.string().min(1) });

export async function seoRoutes(app: FastifyInstance): Promise<void> {
  const getSeoMetadataUseCase = app.diContainer.resolve<GetSeoMetadataUseCase>('getSeoMetadataUseCase');

  // GET /api/v1/seo/:instanceSlug
  app.get('/:instanceSlug', {
    schema: { description: 'Obtenir les metadonnees SEO d\'une instance', tags: ['SEO'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceSlug } = parseBody(instanceSlugParamSchema, request.params);
    const baseUrl = `${request.protocol}://${request.hostname}`;
    const metadata = await getSeoMetadataUseCase.execute(instanceSlug, baseUrl);
    if (!metadata) {
      return reply.status(404).send({ success: false, error: 'Instance not found' });
    }
    return reply.send(successResponse(metadata));
  });
}
