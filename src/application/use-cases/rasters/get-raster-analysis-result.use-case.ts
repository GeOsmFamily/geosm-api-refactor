import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export interface RasterAnalysisResultDTO {
  id: string;
  layerId: string;
  type: string;
  status: string;
  result: unknown;
  error: string | null;
}

/** Lecture du statut/résultat d'un job d'analyse raster - consommé en polling par le frontend. */
export class GetRasterAnalysisResultUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(resultId: string): Promise<RasterAnalysisResultDTO> {
    const row = await this.prisma.rasterAnalysisResult.findUnique({ where: { id: resultId } });
    if (!row) throw new NotFoundError('RasterAnalysisResult', resultId);
    return {
      id: row.id,
      layerId: row.layerId,
      type: row.type,
      status: row.status,
      result: row.result,
      error: row.error,
    };
  }
}
