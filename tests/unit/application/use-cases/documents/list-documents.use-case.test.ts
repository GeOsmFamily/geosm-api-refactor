import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListDocumentsUseCase } from '../../../../../src/application/use-cases/documents/list-documents.use-case.js';

describe('ListDocumentsUseCase', () => {
  let useCase: ListDocumentsUseCase;
  let documentRepository: { findByInstanceId: ReturnType<typeof vi.fn>; findByLayerId: ReturnType<typeof vi.fn> };
  const now = new Date();
  const mockDoc = { id: 'd1', name: 'doc', description: null, filePath: 'path', fileSize: 100, mimeType: 'application/pdf', layerId: null, instanceId: 'inst-1', userId: 'u1', createdAt: now, updatedAt: now };

  beforeEach(() => {
    documentRepository = {
      findByInstanceId: vi.fn().mockResolvedValue([mockDoc]),
      findByLayerId: vi.fn().mockResolvedValue([mockDoc]),
    };
    useCase = new ListDocumentsUseCase(documentRepository as any);
  });

  it('should list documents by instance', async () => {
    const result = await useCase.execute('inst-1');
    expect(result).toEqual([mockDoc]);
    expect(documentRepository.findByInstanceId).toHaveBeenCalledWith('inst-1');
  });

  it('should list documents by layer when layerId provided', async () => {
    const result = await useCase.execute('inst-1', 'layer-1');
    expect(result).toEqual([mockDoc]);
    expect(documentRepository.findByLayerId).toHaveBeenCalledWith('layer-1');
  });
});
