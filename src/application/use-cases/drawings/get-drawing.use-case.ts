import { PrismaDrawingRepository, DrawingRecord } from '../../../infrastructure/database/repositories/prisma-drawing.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetDrawingUseCase');

export class GetDrawingUseCase {
  constructor(private readonly drawingRepository: PrismaDrawingRepository) {}

  async execute(id: string): Promise<DrawingRecord> {
    logger.debug('Fetching drawing', { drawingId: id });
    const drawing = await this.drawingRepository.findById(id);
    if (!drawing) throw new NotFoundError('Drawing', id);
    return drawing;
  }
}
