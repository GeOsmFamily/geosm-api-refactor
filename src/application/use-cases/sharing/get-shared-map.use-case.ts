import { PrismaSharedMapRepository, SharedMapRecord } from '../../../infrastructure/database/repositories/prisma-shared-map.repository.js';
import { PrismaInstanceRepository } from '../../../infrastructure/database/repositories/prisma-instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export interface SharedMapWithInstance extends SharedMapRecord {
  instanceSlug: string | null;
}

export class GetSharedMapUseCase {
  constructor(
    private readonly sharedMapRepository: PrismaSharedMapRepository,
    private readonly instanceRepository: PrismaInstanceRepository,
  ) {}

  async execute(shortCode: string): Promise<SharedMapWithInstance> {
    const shared = await this.sharedMapRepository.findByShortCode(shortCode);
    if (!shared) throw new NotFoundError('SharedMap', shortCode);
    if (shared.expiresAt && shared.expiresAt < new Date()) {
      throw new NotFoundError('SharedMap', shortCode);
    }
    // Le lien de partage doit rester consultable par un visiteur non connecté :
    // on résout ici le slug de l'instance (route publique côté frontend), pour
    // éviter que le frontend n'ait à appeler GET /instances/:id (protégée par
    // authentification) et ne redirige un visiteur anonyme vers /login.
    const instance = await this.instanceRepository.findById(shared.instanceId);
    return { ...shared, instanceSlug: instance?.slug ?? null };
  }
}
