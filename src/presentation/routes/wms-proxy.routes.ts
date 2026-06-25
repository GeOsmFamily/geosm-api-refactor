import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { QgisServerService } from '../../infrastructure/external-apis/qgis-server.service.js';

export async function wmsProxyRoutes(app: FastifyInstance): Promise<void> {
  const qgisServerService = app.diContainer.resolve<QgisServerService>('qgisServerService');

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.query as Record<string, string>;
    const { data, contentType } = await qgisServerService.proxyWmsRequest(params);
    return reply.type(contentType).send(data);
  });
}

export async function wfsProxyRoutes(app: FastifyInstance): Promise<void> {
  const qgisServerService = app.diContainer.resolve<QgisServerService>('qgisServerService');

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.query as Record<string, string>;
    const { data, contentType } = await qgisServerService.proxyWfsRequest(params);
    return reply.type(contentType).send(data);
  });
}
