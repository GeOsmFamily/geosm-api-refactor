import { PrismaDocumentRepository } from '../../../infrastructure/database/repositories/prisma-document.repository.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteDocumentUseCase {
  constructor(
    private readonly documentRepository: PrismaDocumentRepository,
    private readonly storageService: MinioStorageService,
  ) {}

  async execute(id: string): Promise<void> {
    const doc = await this.documentRepository.findById(id);
    if (!doc) throw new NotFoundError('Document', id);
    await this.storageService.deleteFile(doc.filePath);
    await this.documentRepository.delete(id);
  }
}
