import { v4 as uuidv4 } from 'uuid';
import {
  PrismaAssistantConversationRepository,
  AssistantConversationRecord,
} from '../../../infrastructure/database/repositories/prisma-assistant-conversation.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateAssistantConversationUseCase');

export class CreateAssistantConversationUseCase {
  constructor(private readonly conversationRepository: PrismaAssistantConversationRepository) {}

  async execute(userId: string, instanceId: string): Promise<AssistantConversationRecord> {
    const conversation = await this.conversationRepository.create({
      id: uuidv4(),
      userId,
      instanceId,
      title: 'Nouvelle conversation',
    });
    logger.info('Assistant conversation created', { userId, conversationId: conversation.id });
    return conversation;
  }
}
