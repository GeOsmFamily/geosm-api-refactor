import { v4 as uuidv4 } from 'uuid';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import type { Export } from '../../../domain/entities/export.entity.js';
import { ExportFormat, JobStatus } from '../../../domain/enums.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ImportLayerUseCase');

export interface ImportLayerDto {
  layerId: string;
  userId: string;
  fileBuffer: Buffer;
  filename: string;
  mimetype: string;
  format: string;
}

export class ImportLayerUseCase {
  constructor(
    private layerRepository: { findById: (id: string) => Promise<unknown> },
    private exportRepository: { create: (data: Omit<Export, 'createdAt' | 'updatedAt'>) => Promise<Export> },
    private storageService: { uploadFile: (key: string, data: Buffer, contentType?: string) => Promise<string> },
    private queueService: { addJob: (queue: string, name: string, data: Record<string, unknown>) => Promise<unknown> },
  ) {}

  async execute(dto: ImportLayerDto): Promise<{ exportId: string; message: string }> {
    const layer = await this.layerRepository.findById(dto.layerId);
    if (!layer) {
      throw new NotFoundError('Layer', dto.layerId);
    }

    const fileKey = `imports/${dto.layerId}/${uuidv4()}-${dto.filename}`;
    await this.storageService.uploadFile(fileKey, dto.fileBuffer, dto.mimetype);

    const exportRecord = await this.exportRepository.create({
      id: uuidv4(),
      format: dto.format as ExportFormat,
      status: JobStatus.PENDING,
      layerId: dto.layerId,
      layerIds: null,
      isBulk: false,
      userId: dto.userId,
      filePath: fileKey,
      fileSize: dto.fileBuffer.length,
      bbox: [],
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    await this.queueService.addJob('layer-import', 'import', {
      exportId: exportRecord.id,
      layerId: dto.layerId,
      userId: dto.userId,
      fileKey,
      originalFilename: dto.filename,
      format: dto.format,
    });

    logger.info('Layer import job queued', { layerId: dto.layerId, userId: dto.userId, exportId: exportRecord.id, format: dto.format });
    return { exportId: exportRecord.id, message: 'Layer import job queued successfully' };
  }
}
