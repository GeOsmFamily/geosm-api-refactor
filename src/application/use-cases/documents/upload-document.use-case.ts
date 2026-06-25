import { v4 as uuidv4 } from 'uuid';
import { PrismaDocumentRepository, DocumentRecord } from '../../../infrastructure/database/repositories/prisma-document.repository.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';

export interface UploadDocumentDTO {
  name: string;
  description?: string;
  layerId?: string;
  instanceId: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export class UploadDocumentUseCase {
  constructor(
    private readonly documentRepository: PrismaDocumentRepository,
    private readonly storageService: MinioStorageService,
  ) {}

  async execute(userId: string, dto: UploadDocumentDTO): Promise<DocumentRecord> {
    const id = uuidv4();
    const key = `documents/${dto.instanceId}/${id}/${dto.fileName}`;

    await this.storageService.uploadFile(key, dto.fileBuffer, dto.mimeType);

    return this.documentRepository.create({
      id,
      name: dto.name,
      description: dto.description ?? null,
      filePath: key,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      layerId: dto.layerId ?? null,
      instanceId: dto.instanceId,
      userId,
    });
  }
}
