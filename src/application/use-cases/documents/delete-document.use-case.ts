import { PrismaDocumentRepository } from '../../../infrastructure/database/repositories/prisma-document.repository.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteDocumentUseCase');

export class DeleteDocumentUseCase {
  constructor(
    private readonly documentRepository: PrismaDocumentRepository,
    private readonly storageService: MinioStorageService,
  ) {}

  async execute(id: string): Promise<void> {
    const doc = await this.documentRepository.findById(id);
    if (!doc) {
      logger.warn('Delete document rejected: not found', { documentId: id });
      throw new NotFoundError('Document', id);
    }
    try {
      await this.storageService.deleteFile(doc.filePath);
    } catch (error) {
      logger.error('Failed to delete document file from storage', { documentId: id, filePath: doc.filePath, error: (error as Error).message });
      throw error;
    }
    await this.documentRepository.delete(id);
    logger.info('Document deleted', { documentId: id });
  }
}
