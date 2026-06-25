import { PrismaSharedMapRepository, SharedMapRecord } from '../../../infrastructure/database/repositories/prisma-shared-map.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetSharedMapUseCase {
  constructor(private readonly sharedMapRepository: PrismaSharedMapRepository) {}

  async execute(shortCode: string): Promise<SharedMapRecord> {
    const shared = await this.sharedMapRepository.findByShortCode(shortCode);
    if (!shared) throw new NotFoundError('SharedMap', shortCode);
    if (shared.expiresAt && shared.expiresAt < new Date()) {
      throw new NotFoundError('SharedMap', shortCode);
    }
    return shared;
  }
}
