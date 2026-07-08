import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteAssistantConversationUseCase } from '../../../../../src/application/use-cases/assistant/delete-assistant-conversation.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import type { PrismaAssistantConversationRepository } from '../../../../../src/infrastructure/database/repositories/prisma-assistant-conversation.repository.js';

describe('DeleteAssistantConversationUseCase', () => {
  let useCase: DeleteAssistantConversationUseCase;
  let conversationRepository: PrismaAssistantConversationRepository;
  const now = new Date();

  const ownedConversation = {
    id: 'conversation-id',
    userId: 'owner-id',
    title: 'My chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    conversationRepository = {
      findById: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as PrismaAssistantConversationRepository;
    useCase = new DeleteAssistantConversationUseCase(conversationRepository);
  });

  it('should delete the conversation when the requester is the owner', async () => {
    vi.mocked(conversationRepository.findById).mockResolvedValue(ownedConversation as never);

    await useCase.execute('owner-id', 'conversation-id');

    expect(conversationRepository.delete).toHaveBeenCalledWith('conversation-id');
  });

  it('regression (IDOR): should reject deletion by a user who does not own the conversation', async () => {
    vi.mocked(conversationRepository.findById).mockResolvedValue(ownedConversation as never);

    await expect(useCase.execute('someone-else-id', 'conversation-id')).rejects.toThrow(ForbiddenError);
    expect(conversationRepository.delete).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError if the conversation does not exist', async () => {
    vi.mocked(conversationRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('owner-id', 'missing-id')).rejects.toThrow(NotFoundError);
    expect(conversationRepository.delete).not.toHaveBeenCalled();
  });
});
