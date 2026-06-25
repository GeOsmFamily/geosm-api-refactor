import { PrismaDrawingRepository, DrawingRecord } from '../../../infrastructure/database/repositories/prisma-drawing.repository.js';

export class GetDrawingsUseCase {
  constructor(private readonly drawingRepository: PrismaDrawingRepository) {}

  async execute(userId: string, instanceId: string): Promise<DrawingRecord[]> {
    return this.drawingRepository.findByUserId(userId, instanceId);
  }
}
