import { PrismaMapCompositionRepository, MapCompositionRecord } from '../../../infrastructure/database/repositories/prisma-map-composition.repository.js';

export class GetMapCompositionsUseCase {
  constructor(private readonly mapCompositionRepository: PrismaMapCompositionRepository) {}

  async execute(instanceId: string): Promise<MapCompositionRecord[]> {
    return this.mapCompositionRepository.findByInstanceId(instanceId);
  }
}
