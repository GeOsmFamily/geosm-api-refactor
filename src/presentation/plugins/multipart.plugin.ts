import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';

export async function multipartPlugin(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 1,
    },
  });
}
