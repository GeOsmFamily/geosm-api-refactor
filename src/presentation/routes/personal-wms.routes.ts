import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { QgisServerService } from '../../infrastructure/external-apis/qgis-server.service.js';
import { verifyPersonalWmsToken } from '../../infrastructure/utils/personal-wms-token.util.js';
import { ForbiddenError } from '../../domain/errors/forbidden.error.js';

/**
 * Proxy WMS authentifié pour une donnée personnelle QGIS_PROJECT (voir plan "Interopérabilité &
 * sécurité des données" du 2026-08-06) - remplace l'ancienne exposition directe via
 * QGIS_PUBLIC_URL, protégée uniquement par un chemin difficile à deviner (aucune vérification
 * réelle). Le chemin du projet QGIS vient du jeton signé (`token`), JAMAIS d'un paramètre
 * `map`/`MAP` fourni par le client - un jeton valide pour une couche ne permet donc pas d'en
 * lire une autre en changeant ce paramètre. Voir personal-wms-token.util.ts pour le détail du
 * jeton et personal-layers.routes.ts (toDto) pour où il est émis.
 */
export async function personalWmsRoutes(app: FastifyInstance): Promise<void> {
  const qgisServerService = app.diContainer.resolve<QgisServerService>('qgisServerService');

  app.get(
    '/',
    {
      schema: {
        description: "Proxy WMS authentifié pour une donnée personnelle (projet QGIS privé)",
        tags: ['Proxy WMS/WFS'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = { ...(request.query as Record<string, string>) };
      const token = params.token;
      delete params.token;
      // Le chemin ne vient JAMAIS de map/MAP fourni par le client - uniquement du jeton vérifié.
      delete params.map;
      delete params.MAP;

      if (!token) throw new ForbiddenError('Jeton manquant.');
      const payload = verifyPersonalWmsToken(token);
      if (!payload) throw new ForbiddenError('Jeton invalide ou expiré.');

      const { data, contentType } = await qgisServerService.proxyWmsRequest(
        params,
        payload.qgisProjectPath,
      );
      return reply.type(contentType).send(data);
    },
  );
}
