import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaMapCompositionRepository, MapCompositionRecord } from '../../../infrastructure/database/repositories/prisma-map-composition.repository.js';

export interface CreateMapCompositionDTO {
  name: string;
  slug: string;
  description?: string;
  layers: Prisma.InputJsonValue;
  center: Prisma.InputJsonValue;
  zoom?: number;
  isPublic?: boolean;
}

export class CreateMapCompositionUseCase {
  constructor(private readonly mapCompositionRepository: PrismaMapCompositionRepository) {}

  async execute(userId: string, instanceId: string, dto: CreateMapCompositionDTO): Promise<MapCompositionRecord> {
    return this.mapCompositionRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      instanceId,
      layers: dto.layers,
      center: dto.center,
      zoom: dto.zoom ?? 6,
      isPublic: dto.isPublic ?? false,
      userId,
    });
  }
}
