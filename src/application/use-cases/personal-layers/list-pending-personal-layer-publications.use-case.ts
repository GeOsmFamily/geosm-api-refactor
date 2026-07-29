import {
  PrismaPersonalLayerRepository,
  PersonalLayerRecord,
} from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';

/** File d'attente de modération - gardée par requireRole(SUPER_ADMIN, ADMIN_INSTANCE, EDITOR) au niveau route. */
export class ListPendingPersonalLayerPublicationsUseCase {
  constructor(private readonly personalLayerRepository: PrismaPersonalLayerRepository) {}

  execute(instanceId: string): Promise<PersonalLayerRecord[]> {
    return this.personalLayerRepository.listPendingForInstance(instanceId);
  }
}
