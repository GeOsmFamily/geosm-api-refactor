import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error.js';
import { logger } from '../observability/logger.js';

interface WSClient {
  socket: WebSocket;
  userId: string;
}

export class NotificationService {
  private clients: Map<string, WSClient[]> = new Map();

  /**
   * Le WebSocket natif du navigateur ne permet PAS de fixer d'en-tête `Authorization` sur la
   * requête de handshake (limitation du standard, pas de cette app) - `app.authenticate`
   * (basé sur `request.jwtVerify()`, qui ne lit QUE cet en-tête) rejette donc systématiquement
   * toute connexion depuis un vrai navigateur. Confirmé en pratique : aucun client frontend
   * n'utilisait ce endpoint (recherche menée avant le lot "tiroir de tâches" du 2026-08-05) -
   * ce préHandler accepte en plus un token en query string (`?token=...`), seule option
   * praticable pour un WebSocket appelé depuis le navigateur ; conserve le repli sur l'en-tête
   * pour un éventuel client non-navigateur qui peut déjà le fournir.
   */
  private async authenticateWs(
    app: FastifyInstance,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const queryToken = (request.query as Record<string, unknown> | undefined)?.['token'];
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      try {
        request.user = app.jwt.verify(queryToken);
        return;
      } catch {
        throw new UnauthorizedError('Invalid or expired access token');
      }
    }
    await app.authenticate(request, reply);
  }

  registerRoutes(app: FastifyInstance): void {
    app.get(
      '/ws/notifications',
      { websocket: true, preHandler: [(req, reply) => this.authenticateWs(app, req, reply)] },
      (socket, request) => {
        const userId = (request.user as { sub: string }).sub;
        const clients = this.clients.get(userId) || [];
        clients.push({ socket, userId });
        this.clients.set(userId, clients);

        logger.info('WebSocket client connected', { userId });

        socket.on('close', () => {
          const remaining = (this.clients.get(userId) || []).filter((c) => c.socket !== socket);
          if (remaining.length === 0) {
            this.clients.delete(userId);
          } else {
            this.clients.set(userId, remaining);
          }
          logger.info('WebSocket client disconnected', { userId });
        });

        socket.on('message', (msg: Buffer | ArrayBuffer | Buffer[]) => {
          try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'ping') {
              socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
          } catch {
            // ignore invalid messages
          }
        });
      },
    );
  }

  notifyUser(userId: string, event: string, data: unknown): void {
    const clients = this.clients.get(userId) || [];
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    for (const client of clients) {
      try {
        if (client.socket.readyState === 1) {
          client.socket.send(message);
        }
      } catch (err) {
        logger.error('Failed to send WebSocket message', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  notifyAll(event: string, data: unknown): void {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        try {
          if (client.socket.readyState === 1) {
            client.socket.send(message);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  getConnectedUserIds(): string[] {
    return Array.from(this.clients.keys());
  }
}
