import { v4 as uuidv4 } from 'uuid';
import { ILocationPlanRepository } from '../../../domain/repositories/location-plan.repository.js';
import { LocationPlan } from '../../../domain/entities/location-plan.entity.js';
import { CreateLocationPlanDTO } from '../../dtos/location-plan.dto.js';
import { JobStatus, PaperSize, PlanOrientation } from '../../../domain/enums.js';
import type { QueueService } from '../../../infrastructure/queue/queue.service.js';
import type { PrismaInstanceRepository } from '../../../infrastructure/database/repositories/prisma-instance.repository.js';

export class CreateLocationPlanUseCase {
  constructor(
    private readonly locationPlanRepository: ILocationPlanRepository,
    private readonly instanceRepository: PrismaInstanceRepository,
    private readonly queueService: QueueService,
  ) {}

  async execute(userId: string, dto: CreateLocationPlanDTO): Promise<LocationPlan> {
    const instance = await this.instanceRepository.findById(dto.instanceId);
    if (!instance) throw new Error(`Instance ${dto.instanceId} not found`);

    const id = uuidv4();
    const record = await this.locationPlanRepository.create({
      id,
      userId,
      instanceId: dto.instanceId,
      status: JobStatus.PENDING,
      title: dto.title,
      description: dto.description ?? null,
      landmark: dto.landmark ?? null,
      lon: dto.lon,
      lat: dto.lat,
      scale: dto.scale ?? null,
      paperSize: dto.paperSize ?? PaperSize.A4,
      orientation: dto.orientation ?? PlanOrientation.PORTRAIT,
      filePath: null,
      fileSize: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    await this.queueService.addJob('location-plan', 'generate', {
      locationPlanId: id,
      userId,
      lon: dto.lon,
      lat: dto.lat,
      title: dto.title,
      description: dto.description,
      landmark: dto.landmark,
      scale: dto.scale,
      paperSize: record.paperSize,
      orientation: record.orientation,
      instanceBbox: instance.bbox ?? null,
    });

    return record;
  }
}
