import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../../domain/errors/validation.error.js';

export interface SpatialAnalysisInput {
  operation: 'buffer' | 'intersection' | 'union' | 'difference';
  geometryA: Record<string, unknown>;
  geometryB?: Record<string, unknown>;
  distance?: number;
  srid?: number;
  outputFormat?: 'geojson' | 'wkt';
}

export interface SpatialAnalysisResult {
  type: string;
  geometry: unknown;
}

export class SpatialAnalysisUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  private validateGeometry(geom: Record<string, unknown>): string {
    if (!geom.type || !geom.coordinates) {
      throw new ValidationError('Invalid GeoJSON geometry', { type: 'required', coordinates: 'required' });
    }
    return JSON.stringify(geom).replace(/'/g, "''");
  }

  async execute(input: SpatialAnalysisInput): Promise<SpatialAnalysisResult> {
    const srid = Number(input.srid) || 4326;
    const safeA = this.validateGeometry(input.geometryA);

    let sql: string;

    switch (input.operation) {
      case 'buffer': {
        const dist = Math.abs(Number(input.distance) || 100);
        sql = `SELECT ST_AsGeoJSON(ST_Buffer(ST_SetSRID(ST_GeomFromGeoJSON('${safeA}'), ${srid})::geography, ${dist}))::json AS geometry`;
        break;
      }
      case 'intersection':
      case 'union':
      case 'difference': {
        if (!input.geometryB) {
          throw new ValidationError(`geometryB is required for ${input.operation}`, {});
        }
        const safeB = this.validateGeometry(input.geometryB);
        const fn = input.operation === 'intersection' ? 'ST_Intersection'
          : input.operation === 'union' ? 'ST_Union' : 'ST_Difference';
        sql = `SELECT ST_AsGeoJSON(${fn}(ST_SetSRID(ST_GeomFromGeoJSON('${safeA}'), ${srid}), ST_SetSRID(ST_GeomFromGeoJSON('${safeB}'), ${srid})))::json AS geometry`;
        break;
      }
    }

    const rows = await this.prisma.$queryRawUnsafe<{ geometry: unknown }[]>(sql);
    return {
      type: input.operation,
      geometry: rows[0]?.geometry ?? null,
    };
  }
}
