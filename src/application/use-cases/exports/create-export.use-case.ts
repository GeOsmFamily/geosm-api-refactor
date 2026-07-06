import { v4 as uuidv4 } from 'uuid';
import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { Export } from '../../../domain/entities/export.entity.js';
import { CreateExportDTO } from '../../dtos/export.dto.js';
import { JobStatus } from '../../../domain/enums.js';
import type { QueueService } from '../../../infrastructure/queue/queue.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateExportUseCase');

export class CreateExportUseCase {
  constructor(
    private readonly exportRepository: IExportRepository,
    private readonly queueService?: QueueService,
  ) {}

  async execute(userId: string, dto: CreateExportDTO): Promise<Export> {
    const id = uuidv4();
    const exportRecord = await this.exportRepository.create({
      id,
      format: dto.format,
      status: JobStatus.PENDING,
      layerId: dto.layerId,
      layerIds: null,
      isBulk: false,
      userId,
      filePath: null,
      fileSize: null,
      bbox: dto.bbox ?? null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    // Queue export job if queue service is available
    if (this.queueService) {
      await this.queueService.addJob('layer-export', 'export', {
        exportId: id,
        layerId: dto.layerId,
        userId,
        format: dto.format,
        bbox: dto.bbox,
        featureId: dto.featureId,
      });
    }

    logger.info('Export created', { userId, exportId: id, format: dto.format, queued: !!this.queueService });
    return exportRecord;
  }
}
