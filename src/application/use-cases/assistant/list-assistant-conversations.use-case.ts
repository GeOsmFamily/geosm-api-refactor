import { PrismaAssistantConversationRepository } from '../../../infrastructure/database/repositories/prisma-assistant-conversation.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListAssistantConversationsUseCase');

export interface AssistantConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

export class ListAssistantConversationsUseCase {
  constructor(private readonly conversationRepository: PrismaAssistantConversationRepository) {}

  async execute(userId: string, instanceId: string): Promise<AssistantConversationSummary[]> {
    logger.debug('Listing assistant conversations', { userId, instanceId });
    const records = await this.conversationRepository.findByUserAndInstance(userId, instanceId);
    return records.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt }));
  }
}
