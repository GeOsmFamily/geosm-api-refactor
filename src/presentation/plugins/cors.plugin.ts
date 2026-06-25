import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { appConfig } from '../../config/app.config.js';

export async function corsPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyCors, {
    origin: appConfig.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
