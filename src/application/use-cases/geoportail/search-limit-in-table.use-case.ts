import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SearchLimitInTableUseCase');

export class SearchLimitInTableUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tableName: string, lat: number, lon: number) {
    const parts = tableName.split('.');
    const schema = parts.length > 1 ? parts[0].replace(/[^a-zA-Z0-9_]/g, '') : 'public';
    const table = (parts.length > 1 ? parts[1] : parts[0]).replace(/[^a-zA-Z0-9_]/g, '');

    const results = await this.prisma.$queryRawUnsafe<{ id: number; name: string; geojson: unknown }[]>(
      `SELECT id, name, ST_AsGeoJSON(geom)::json AS geojson
       FROM "${schema}"."${table}"
       WHERE ST_Intersects(geom, ST_SetSRID(ST_MakePoint(${Number(lon)}, ${Number(lat)}), 4326))
       ORDER BY ST_Area(geom) ASC`
    );
    logger.debug('Searched limit in table', { tableName, lat, lon, count: results.length });
    return results;
  }
}
