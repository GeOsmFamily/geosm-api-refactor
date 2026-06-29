import { PrismaGeosignetRepository } from '../../../infrastructure/database/repositories/prisma-geosignet.repository.js';

export class DeleteGeosignetUseCase {
  constructor(private readonly geosignetRepository: PrismaGeosignetRepository) {}

  async execute(id: string): Promise<void> {
    await this.geosignetRepository.delete(id);
  }
}
