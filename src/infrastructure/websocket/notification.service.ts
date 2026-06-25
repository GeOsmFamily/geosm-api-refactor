import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { logger } from '../observability/logger.js';

interface WSClient {
  socket: WebSocket;
  userId: string;
}

export class NotificationService {
  private clients: Map<string, WSClient[]> = new Map();

  registerRoutes(app: FastifyInstance): void {
    app.get('/ws/notifications', { websocket: true, preHandler: [app.authenticate] }, (socket, request) => {
      const userId = (request.user as { sub: string }).sub;
      const clients = this.clients.get(userId) || [];
      clients.push({ socket, userId });
      this.clients.set(userId, clients);

      logger.info('WebSocket client connected', { userId });

      socket.on('close', () => {
        const remaining = (this.clients.get(userId) || []).filter(c => c.socket !== socket);
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
    });
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
        logger.error('Failed to send WebSocket message', { userId, error: err instanceof Error ? err.message : String(err) });
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
