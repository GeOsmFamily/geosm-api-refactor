import { v4 as uuidv4 } from 'uuid';
import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { Export } from '../../../domain/entities/export.entity.js';
import { CreateBulkExportDTO } from '../../dtos/export.dto.js';
import { JobStatus } from '../../../domain/enums.js';
import type { QueueService } from '../../../infrastructure/queue/queue.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateBulkExportUseCase');

export class CreateBulkExportUseCase {
  constructor(
    private readonly exportRepository: IExportRepository,
    private readonly queueService?: QueueService,
  ) {}

  async execute(userId: string, dto: CreateBulkExportDTO): Promise<Export> {
    const id = uuidv4();
    const exportRecord = await this.exportRepository.create({
      id,
      format: dto.format,
      status: JobStatus.PENDING,
      layerId: null,
      layerIds: dto.layerIds,
      isBulk: true,
      userId,
      filePath: null,
      fileSize: null,
      bbox: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    if (this.queueService) {
      await this.queueService.addJob('layer-export', 'bulk-export', {
        exportId: id,
        layerIds: dto.layerIds,
        userId,
        format: dto.format,
        isBulk: true,
      });
    }

    return exportRecord;
  }
}
