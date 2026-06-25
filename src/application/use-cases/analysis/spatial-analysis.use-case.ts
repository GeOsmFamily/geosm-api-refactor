import { PrismaClient } from '@prisma/client';

export interface SpatialAnalysisInput {
  operation: 'buffer' | 'intersection' | 'union' | 'difference';
  geometryA: string; // GeoJSON string
  geometryB?: string; // GeoJSON string (required for intersection, union, difference)
  distance?: number; // meters, for buffer
  srid?: number;
}

export interface SpatialAnalysisResult {
  type: string;
  geometry: unknown;
}

export class SpatialAnalysisUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: SpatialAnalysisInput): Promise<SpatialAnalysisResult> {
    const srid = input.srid ?? 4326;
    const safeA = input.geometryA.replace(/'/g, "''");

    let sql: string;

    switch (input.operation) {
      case 'buffer': {
        const dist = Number(input.distance) || 100;
        sql = `SELECT ST_AsGeoJSON(ST_Buffer(ST_SetSRID(ST_GeomFromGeoJSON('${safeA}'), ${srid})::geography, ${dist}))::json AS geometry`;
        break;
      }
      case 'intersection': {
        const safeB = (input.geometryB ?? '').replace(/'/g, "''");
        sql = `SELECT ST_AsGeoJSON(ST_Intersection(ST_SetSRID(ST_GeomFromGeoJSON('${safeA}'), ${srid}), ST_SetSRID(ST_GeomFromGeoJSON('${safeB}'), ${srid})))::json AS geometry`;
        break;
      }
      case 'union': {
        const safeB = (input.geometryB ?? '').replace(/'/g, "''");
        sql = `SELECT ST_AsGeoJSON(ST_Union(ST_SetSRID(ST_GeomFromGeoJSON('${safeA}'), ${srid}), ST_SetSRID(ST_GeomFromGeoJSON('${safeB}'), ${srid})))::json AS geometry`;
        break;
      }
      case 'difference': {
        const safeB = (input.geometryB ?? '').replace(/'/g, "''");
        sql = `SELECT ST_AsGeoJSON(ST_Difference(ST_SetSRID(ST_GeomFromGeoJSON('${safeA}'), ${srid}), ST_SetSRID(ST_GeomFromGeoJSON('${safeB}'), ${srid})))::json AS geometry`;
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
