import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetDocumentUseCase } from '../../../../../src/application/use-cases/documents/get-document.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('GetDocumentUseCase', () => {
  let useCase: GetDocumentUseCase;
  let documentRepository: { findById: ReturnType<typeof vi.fn> };
  const now = new Date();
  const mockDoc = { id: 'd1', name: 'doc', description: null, filePath: 'path', fileSize: 100, mimeType: 'application/pdf', layerId: null, instanceId: 'inst-1', userId: 'u1', createdAt: now, updatedAt: now };

  beforeEach(() => {
    documentRepository = { findById: vi.fn() };
    useCase = new GetDocumentUseCase(documentRepository as any);
  });

  it('should return document when found', async () => {
    documentRepository.findById.mockResolvedValue(mockDoc);
    const result = await useCase.execute('d1');
    expect(result).toEqual(mockDoc);
  });

  it('should throw NotFoundError when document not found', async () => {
    documentRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute('bad')).rejects.toThrow(NotFoundError);
  });
});
