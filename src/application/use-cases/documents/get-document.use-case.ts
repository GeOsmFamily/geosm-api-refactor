import { PrismaDocumentRepository, DocumentRecord } from '../../../infrastructure/database/repositories/prisma-document.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetDocumentUseCase {
  constructor(private readonly documentRepository: PrismaDocumentRepository) {}

  async execute(id: string): Promise<DocumentRecord> {
    const doc = await this.documentRepository.findById(id);
    if (!doc) throw new NotFoundError('Document', id);
    return doc;
  }
}
