import {
  PrismaDocumentRepository,
  DocumentRecord,
} from '../../../infrastructure/database/repositories/prisma-document.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetDocumentUseCase');

export class GetDocumentUseCase {
  constructor(private readonly documentRepository: PrismaDocumentRepository) {}

  async execute(id: string): Promise<DocumentRecord> {
    logger.debug('Fetching document', { documentId: id });
    const doc = await this.documentRepository.findById(id);
    if (!doc) throw new NotFoundError('Document', id);
    return doc;
  }
}
