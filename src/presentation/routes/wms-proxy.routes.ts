import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { QgisServerService } from '../../infrastructure/external-apis/qgis-server.service.js';

export async function wmsProxyRoutes(app: FastifyInstance): Promise<void> {
  const qgisServerService = app.diContainer.resolve<QgisServerService>('qgisServerService');

  app.get(
    '/',
    {
      schema: { description: 'Proxy WMS vers QGIS Server', tags: ['Proxy WMS/WFS'] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.query as Record<string, string>;
      const mapPath = params.map || params.MAP;
      const { data, contentType } = await qgisServerService.proxyWmsRequest(params, mapPath);
      return reply.type(contentType).send(data);
    },
  );
}

export async function wfsProxyRoutes(app: FastifyInstance): Promise<void> {
  const qgisServerService = app.diContainer.resolve<QgisServerService>('qgisServerService');

  app.get(
    '/',
    {
      schema: { description: 'Proxy WFS vers QGIS Server', tags: ['Proxy WMS/WFS'] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.query as Record<string, string>;
      const mapPath = params.map || params.MAP;
      const { data, contentType } = await qgisServerService.proxyWfsRequest(params, mapPath);
      return reply.type(contentType).send(data);
    },
  );
}
