import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaDrawingRepository, DrawingRecord } from '../../../infrastructure/database/repositories/prisma-drawing.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SaveDrawingUseCase');

export interface SaveDrawingDTO {
  name: string;
  geojson: Prisma.InputJsonValue;
  description?: string;
  isPublic?: boolean;
}

export class SaveDrawingUseCase {
  constructor(private readonly drawingRepository: PrismaDrawingRepository) {}

  async execute(userId: string, instanceId: string, dto: SaveDrawingDTO): Promise<DrawingRecord> {
    const drawing = await this.drawingRepository.create({
      id: uuidv4(),
      userId,
      instanceId,
      name: dto.name,
      geojson: dto.geojson,
      description: dto.description ?? null,
      isPublic: dto.isPublic ?? false,
    });
    logger.info('Drawing saved', { drawingId: drawing.id, userId, instanceId });
    return drawing;
  }
}
