import { v4 as uuidv4 } from 'uuid';
import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { Export } from '../../../domain/entities/export.entity.js';
import { CreateExportDTO } from '../../dtos/export.dto.js';
import { JobStatus } from '../../../domain/enums.js';

export class CreateExportUseCase {
  constructor(
    private readonly exportRepository: IExportRepository,
  ) {}

  async execute(userId: string, dto: CreateExportDTO): Promise<Export> {
    return this.exportRepository.create({
      id: uuidv4(),
      format: dto.format,
      status: JobStatus.PENDING,
      layerId: dto.layerId,
      userId,
      filePath: null,
      fileSize: null,
      bbox: dto.bbox ?? null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });
  }
}
