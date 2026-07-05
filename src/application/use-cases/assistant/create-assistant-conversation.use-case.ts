import { v4 as uuidv4 } from 'uuid';
import { PrismaAssistantConversationRepository, AssistantConversationRecord } from '../../../infrastructure/database/repositories/prisma-assistant-conversation.repository.js';

export class CreateAssistantConversationUseCase {
  constructor(private readonly conversationRepository: PrismaAssistantConversationRepository) {}

  async execute(userId: string, instanceId: string): Promise<AssistantConversationRecord> {
    return this.conversationRepository.create({
      id: uuidv4(), userId, instanceId, title: 'Nouvelle conversation',
    });
  }
}
