import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaSharedMapRepository, SharedMapRecord } from '../../../infrastructure/database/repositories/prisma-shared-map.repository.js';
import crypto from 'crypto';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateSharedMapUseCase');

export interface CreateSharedMapDTO {
  mapState: Prisma.InputJsonValue;
  expiresInDays?: number;
}

export class CreateSharedMapUseCase {
  constructor(private readonly sharedMapRepository: PrismaSharedMapRepository) {}

  async execute(userId: string, instanceId: string, dto: CreateSharedMapDTO): Promise<SharedMapRecord> {
    const shortCode = crypto.randomBytes(4).toString('hex'); // 8 hex chars
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const shared = await this.sharedMapRepository.create({
      id: uuidv4(),
      userId,
      instanceId,
      mapState: dto.mapState,
      shortCode,
      expiresAt,
    });
    logger.info('Shared map created', { userId, instanceId, shortCode });
    return shared;
  }
}
