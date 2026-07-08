import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('FindAdminBoundaryUseCase');

export interface AdminBoundaryResult {
  id: number;
  name: string;
  adminLevel: number;
  geojson: unknown;
}

export class FindAdminBoundaryUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    lat: number,
    lon: number,
    tableName: string = 'public.admin_boundaries',
  ): Promise<AdminBoundaryResult[]> {
    const parts = tableName.split('.');
    const schema = parts.length > 1 ? parts[0] : 'public';
    const table = parts.length > 1 ? parts[1] : parts[0];

    const results = await this.prisma.$queryRawUnsafe<AdminBoundaryResult[]>(
      `SELECT id, name, admin_level AS "adminLevel", ST_AsGeoJSON(geom)::json AS geojson
       FROM "${schema}"."${table}"
       WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
       ORDER BY admin_level DESC`,
      lon,
      lat,
    );
    logger.debug('Found admin boundaries', { lat, lon, tableName, count: results.length });
    return results;
  }
}
