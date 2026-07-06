import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteCommentUseCase } from '../../../../../src/application/use-cases/comments/delete-comment.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import type { PrismaCommentRepository } from '../../../../../src/infrastructure/database/repositories/prisma-comment.repository.js';

describe('DeleteCommentUseCase', () => {
  let useCase: DeleteCommentUseCase;
  let commentRepository: PrismaCommentRepository;
  const now = new Date();

  const ownedComment = {
    id: 'comment-id',
    userId: 'owner-id',
    instanceId: 'instance-id',
    text: 'hello',
    lat: 0,
    lon: 0,
    parentId: null,
    resolved: false,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    commentRepository = {
      findById: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as PrismaCommentRepository;
    useCase = new DeleteCommentUseCase(commentRepository);
  });

  it('should delete the comment when the requester is the owner', async () => {
    vi.mocked(commentRepository.findById).mockResolvedValue(ownedComment);

    await useCase.execute('owner-id', 'comment-id');

    expect(commentRepository.delete).toHaveBeenCalledWith('comment-id');
  });

  it('regression (IDOR): should reject deletion by a user who does not own the comment', async () => {
    vi.mocked(commentRepository.findById).mockResolvedValue(ownedComment);

    await expect(useCase.execute('someone-else-id', 'comment-id')).rejects.toThrow(ForbiddenError);
    expect(commentRepository.delete).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError if the comment does not exist', async () => {
    vi.mocked(commentRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('owner-id', 'missing-id')).rejects.toThrow(NotFoundError);
    expect(commentRepository.delete).not.toHaveBeenCalled();
  });
});
