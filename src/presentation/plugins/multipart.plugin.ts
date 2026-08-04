import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';

export async function multipartPlugin(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      // 2GB - les rasters (orthophotos, MNT/DEM) dépassent largement les 100MB initiaux prévus
      // pour les imports vectoriels ; voir aussi client_max_body_size dans nginx.conf (frontend)
      // et Timeout/ProxyTimeout dans le vhost Apache, qui doivent rester cohérents avec cette
      // limite - sans ça une des trois couches rejette la requête avant même d'arriver ici.
      fileSize: 2 * 1024 * 1024 * 1024,
      files: 1,
    },
  });
}
