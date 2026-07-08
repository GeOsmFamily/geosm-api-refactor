import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SaveCoordPdfUseCase');

export interface CoordPdfInput {
  instanceId: string;
  coordinates: { lat: number; lon: number }[];
  title?: string;
  description?: string;
  userId: string;
}

export class SaveCoordPdfUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CoordPdfInput) {
    // Store coordinate annotation metadata
    const result = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO public.coord_pdf_annotations (instance_id, coordinates, title, description, user_id, created_at)
       VALUES ($1, $2::jsonb, $3, $4, $5, NOW())
       RETURNING id::text`,
      input.instanceId,
      JSON.stringify(input.coordinates),
      input.title ?? '',
      input.description ?? '',
      input.userId,
    );
    logger.info('Coordinate PDF annotation saved', {
      instanceId: input.instanceId,
      userId: input.userId,
      id: result[0]?.id,
    });
    return { id: result[0]?.id, coordinates: input.coordinates };
  }
}
