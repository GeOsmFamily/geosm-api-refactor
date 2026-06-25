import { PrismaDrawingRepository } from '../../../infrastructure/database/repositories/prisma-drawing.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteDrawingUseCase {
  constructor(private readonly drawingRepository: PrismaDrawingRepository) {}

  async execute(id: string): Promise<void> {
    const drawing = await this.drawingRepository.findById(id);
    if (!drawing) throw new NotFoundError('Drawing', id);
    await this.drawingRepository.delete(id);
  }
}
