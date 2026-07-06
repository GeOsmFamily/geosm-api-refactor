import { PrismaAssistantConversationRepository } from '../../../infrastructure/database/repositories/prisma-assistant-conversation.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteAssistantConversationUseCase');

export class DeleteAssistantConversationUseCase {
  constructor(private readonly conversationRepository: PrismaAssistantConversationRepository) {}

  async execute(userId: string, id: string): Promise<void> {
    const record = await this.conversationRepository.findById(id);
    if (!record) throw new NotFoundError('AssistantConversation', id);
    if (record.userId !== userId) {
      logger.warn('Delete assistant conversation rejected: not the owner', { requestingUserId: userId, ownerId: record.userId, conversationId: id });
      throw new ForbiddenError('Cette conversation appartient à un autre utilisateur.');
    }
    await this.conversationRepository.delete(id);
    logger.info('Assistant conversation deleted', { userId, conversationId: id });
  }
}
