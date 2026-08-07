import { v4 as uuidv4 } from 'uuid';
import {
  PrismaCommentRepository,
  CommentRecord,
} from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import type { NotificationService } from '../../../infrastructure/websocket/notification.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ReplyToCommentUseCase');

export class ReplyToCommentUseCase {
  constructor(
    private readonly commentRepository: PrismaCommentRepository,
    private readonly notificationService: NotificationService,
  ) {}

  // instanceId/lat/lon sont hérités du commentaire racine (pas fournis par le client) : une
  // réponse n'a pas de position propre sur la carte, elle appartient au pin du parent.
  async execute(userId: string, parentId: string, text: string): Promise<CommentRecord> {
    const parent = await this.commentRepository.findById(parentId);
    if (!parent) throw new NotFoundError('Comment', parentId);

    const reply = await this.commentRepository.create({
      id: uuidv4(),
      userId,
      instanceId: parent.instanceId,
      text,
      lat: parent.lat,
      lon: parent.lon,
      parentId: parent.parentId ?? parent.id,
    });
    logger.info('Comment reply created', { userId, parentId, replyId: reply.id });

    // Notifie l'auteur du commentaire répondu (voir plan "Centre de notifications unifié" du
    // 2026-08-06) - jamais si on se répond à soi-même, et jamais bloquant pour la réponse
    // elle-même (notifyUser avale déjà ses propres erreurs, voir notification.service.ts).
    if (parent.userId !== userId) {
      void this.notificationService.notifyUser(parent.userId, 'comment-reply', {
        commentId: parent.id,
        replyId: reply.id,
        replyText: text,
        instanceId: parent.instanceId,
      });
    }

    return reply;
  }
}
