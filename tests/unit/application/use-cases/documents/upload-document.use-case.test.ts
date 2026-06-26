import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadDocumentUseCase } from '../../../../../src/application/use-cases/documents/upload-document.use-case.js';

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('UploadDocumentUseCase', () => {
  let useCase: UploadDocumentUseCase;
  let documentRepository: { create: ReturnType<typeof vi.fn> };
  let storageService: { uploadFile: ReturnType<typeof vi.fn> };
  const now = new Date();

  beforeEach(() => {
    documentRepository = { create: vi.fn() };
    storageService = { uploadFile: vi.fn().mockResolvedValue(undefined) };
    useCase = new UploadDocumentUseCase(documentRepository as any, storageService as any);
  });

  it('should upload document and create record', async () => {
    const mockRecord = { id: 'mock-uuid', name: 'Report', description: null, filePath: 'documents/inst-1/mock-uuid/report.pdf', fileSize: 5000, mimeType: 'application/pdf', layerId: null, instanceId: 'inst-1', userId: 'u1', createdAt: now, updatedAt: now };
    documentRepository.create.mockResolvedValue(mockRecord);

    const result = await useCase.execute('u1', {
      name: 'Report',
      instanceId: 'inst-1',
      fileBuffer: Buffer.from('data'),
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      fileSize: 5000,
    });

    expect(result).toEqual(mockRecord);
    expect(storageService.uploadFile).toHaveBeenCalledWith(
      'documents/inst-1/mock-uuid/report.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(documentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'mock-uuid',
      name: 'Report',
      instanceId: 'inst-1',
      userId: 'u1',
    }));
  });

  it('should propagate storage errors', async () => {
    storageService.uploadFile.mockRejectedValue(new Error('Storage unavailable'));
    await expect(useCase.execute('u1', {
      name: 'Report',
      instanceId: 'inst-1',
      fileBuffer: Buffer.from('data'),
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      fileSize: 5000,
    })).rejects.toThrow('Storage unavailable');
  });
});
