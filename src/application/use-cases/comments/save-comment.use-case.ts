import { v4 as uuidv4 } from 'uuid';
import { PrismaCommentRepository, CommentRecord } from '../../../infrastructure/database/repositories/prisma-comment.repository.js';

export interface SaveCommentDTO {
  instanceId: string;
  text: string;
  lat: number;
  lon: number;
}

export class SaveCommentUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(userId: string, dto: SaveCommentDTO): Promise<CommentRecord> {
    return this.commentRepository.create({
      id: uuidv4(),
      userId,
      instanceId: dto.instanceId,
      text: dto.text,
      lat: dto.lat,
      lon: dto.lon,
    });
  }
}
