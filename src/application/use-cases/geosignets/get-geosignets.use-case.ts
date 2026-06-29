import { PrismaGeosignetRepository, GeosignetRecord } from '../../../infrastructure/database/repositories/prisma-geosignet.repository.js';

export class GetGeosignetsUseCase {
  constructor(private readonly geosignetRepository: PrismaGeosignetRepository) {}

  async execute(userId: string): Promise<GeosignetRecord[]> {
    return this.geosignetRepository.findByUserId(userId);
  }
}
