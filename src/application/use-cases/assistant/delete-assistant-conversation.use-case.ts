import { PrismaAssistantConversationRepository } from '../../../infrastructure/database/repositories/prisma-assistant-conversation.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';

export class DeleteAssistantConversationUseCase {
  constructor(private readonly conversationRepository: PrismaAssistantConversationRepository) {}

  async execute(userId: string, id: string): Promise<void> {
    const record = await this.conversationRepository.findById(id);
    if (!record) throw new NotFoundError('AssistantConversation', id);
    if (record.userId !== userId) throw new ForbiddenError('Cette conversation appartient à un autre utilisateur.');
    await this.conversationRepository.delete(id);
  }
}
