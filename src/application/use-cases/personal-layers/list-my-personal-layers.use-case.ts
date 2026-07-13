import {
  PrismaPersonalLayerRepository,
  PersonalLayerRecord,
} from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';

export class ListMyPersonalLayersUseCase {
  constructor(private readonly personalLayerRepository: PrismaPersonalLayerRepository) {}

  execute(userId: string, instanceId: string): Promise<PersonalLayerRecord[]> {
    return this.personalLayerRepository.listForUser(userId, instanceId);
  }
}
