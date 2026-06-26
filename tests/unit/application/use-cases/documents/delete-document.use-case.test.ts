import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteDocumentUseCase } from '../../../../../src/application/use-cases/documents/delete-document.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('DeleteDocumentUseCase', () => {
  let useCase: DeleteDocumentUseCase;
  let documentRepository: { findById: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let storageService: { deleteFile: ReturnType<typeof vi.fn> };
  const now = new Date();
  const mockDoc = { id: 'd1', name: 'doc', description: null, filePath: 'documents/inst-1/d1/file.pdf', fileSize: 100, mimeType: 'application/pdf', layerId: null, instanceId: 'inst-1', userId: 'u1', createdAt: now, updatedAt: now };

  beforeEach(() => {
    documentRepository = { findById: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) };
    storageService = { deleteFile: vi.fn().mockResolvedValue(undefined) };
    useCase = new DeleteDocumentUseCase(documentRepository as any, storageService as any);
  });

  it('should delete document and file', async () => {
    documentRepository.findById.mockResolvedValue(mockDoc);
    await useCase.execute('d1');
    expect(storageService.deleteFile).toHaveBeenCalledWith('documents/inst-1/d1/file.pdf');
    expect(documentRepository.delete).toHaveBeenCalledWith('d1');
  });

  it('should throw NotFoundError when document not found', async () => {
    documentRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute('bad')).rejects.toThrow(NotFoundError);
  });
});
