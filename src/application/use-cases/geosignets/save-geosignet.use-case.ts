import { v4 as uuidv4 } from 'uuid';
import {
  PrismaGeosignetRepository,
  GeosignetRecord,
} from '../../../infrastructure/database/repositories/prisma-geosignet.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SaveGeosignetUseCase');

export interface SaveGeosignetDTO {
  name: string;
  center: number[];
  zoom: number;
}

export class SaveGeosignetUseCase {
  constructor(private readonly geosignetRepository: PrismaGeosignetRepository) {}

  async execute(userId: string, dto: SaveGeosignetDTO): Promise<GeosignetRecord> {
    const geosignet = await this.geosignetRepository.create({
      id: uuidv4(),
      userId,
      name: dto.name,
      center: dto.center,
      zoom: dto.zoom,
    });
    logger.info('Geosignet saved', { userId, geosignetId: geosignet.id, name: dto.name });
    return geosignet;
  }
}
