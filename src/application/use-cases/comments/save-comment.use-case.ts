import { v4 as uuidv4 } from 'uuid';
import { CommentReportType } from '@prisma/client';
import {
  PrismaCommentRepository,
  CommentRecord,
} from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SaveCommentUseCase');

export interface SaveCommentDTO {
  instanceId: string;
  text: string;
  lat: number;
  lon: number;
  // Signalement structuré sur une entité précise (voir plan "Gouvernance citoyenne & qualité
  // IA" du 2026-08-06) - tous optionnels : un commentaire "libre" classique (comportement
  // historique) ne renseigne aucun de ces champs.
  reportType?: CommentReportType;
  layerId?: string;
  featureId?: string;
}

export class SaveCommentUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(userId: string, dto: SaveCommentDTO): Promise<CommentRecord> {
    const comment = await this.commentRepository.create({
      id: uuidv4(),
      userId,
      instanceId: dto.instanceId,
      text: dto.text,
      lat: dto.lat,
      lon: dto.lon,
      reportType: dto.reportType ?? null,
      layerId: dto.layerId ?? null,
      featureId: dto.featureId ?? null,
    });
    logger.info('Comment created', { userId, commentId: comment.id, instanceId: dto.instanceId });
    return comment;
  }
}
