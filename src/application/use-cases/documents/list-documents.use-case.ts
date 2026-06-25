import { PrismaDocumentRepository, DocumentRecord } from '../../../infrastructure/database/repositories/prisma-document.repository.js';

export class ListDocumentsUseCase {
  constructor(private readonly documentRepository: PrismaDocumentRepository) {}

  async execute(instanceId: string, layerId?: string): Promise<DocumentRecord[]> {
    if (layerId) {
      return this.documentRepository.findByLayerId(layerId);
    }
    return this.documentRepository.findByInstanceId(instanceId);
  }
}
