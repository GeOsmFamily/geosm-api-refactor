import {
  PrismaDocumentRepository,
  DocumentRecord,
} from '../../../infrastructure/database/repositories/prisma-document.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListDocumentsUseCase');

export class ListDocumentsUseCase {
  constructor(private readonly documentRepository: PrismaDocumentRepository) {}

  async execute(instanceId: string, layerId?: string): Promise<DocumentRecord[]> {
    logger.debug('Listing documents', { instanceId, layerId });
    if (layerId) {
      return this.documentRepository.findByLayerId(layerId);
    }
    return this.documentRepository.findByInstanceId(instanceId);
  }
}
