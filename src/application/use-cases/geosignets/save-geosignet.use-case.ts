import { v4 as uuidv4 } from 'uuid';
import { PrismaGeosignetRepository, GeosignetRecord } from '../../../infrastructure/database/repositories/prisma-geosignet.repository.js';

export interface SaveGeosignetDTO {
  name: string;
  center: number[];
  zoom: number;
}

export class SaveGeosignetUseCase {
  constructor(private readonly geosignetRepository: PrismaGeosignetRepository) {}

  async execute(userId: string, dto: SaveGeosignetDTO): Promise<GeosignetRecord> {
    return this.geosignetRepository.create({
      id: uuidv4(),
      userId,
      name: dto.name,
      center: dto.center,
      zoom: dto.zoom,
    });
  }
}
