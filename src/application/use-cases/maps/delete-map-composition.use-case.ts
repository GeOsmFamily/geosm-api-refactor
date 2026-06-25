import { PrismaMapCompositionRepository } from '../../../infrastructure/database/repositories/prisma-map-composition.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteMapCompositionUseCase {
  constructor(private readonly mapCompositionRepository: PrismaMapCompositionRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.mapCompositionRepository.findById(id);
    if (!existing) throw new NotFoundError('MapComposition', id);
    await this.mapCompositionRepository.delete(id);
  }
}
