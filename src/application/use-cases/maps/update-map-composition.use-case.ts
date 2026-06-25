import { Prisma } from '@prisma/client';
import { PrismaMapCompositionRepository, MapCompositionRecord } from '../../../infrastructure/database/repositories/prisma-map-composition.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export interface UpdateMapCompositionDTO {
  name?: string;
  slug?: string;
  description?: string | null;
  layers?: Prisma.InputJsonValue;
  center?: Prisma.InputJsonValue;
  zoom?: number;
  isPublic?: boolean;
}

export class UpdateMapCompositionUseCase {
  constructor(private readonly mapCompositionRepository: PrismaMapCompositionRepository) {}

  async execute(id: string, dto: UpdateMapCompositionDTO): Promise<MapCompositionRecord> {
    const existing = await this.mapCompositionRepository.findById(id);
    if (!existing) throw new NotFoundError('MapComposition', id);
    return this.mapCompositionRepository.update(id, dto);
  }
}
