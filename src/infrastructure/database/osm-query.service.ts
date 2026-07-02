import { PrismaClient } from '@prisma/client';
import { logger } from '../observability/logger.js';
import type { GeoJSONFeature, GeoJSONFeatureCollection } from './postgis.service.js';

export interface OsmKeyValue {
  key: string;
  value: string;
}

export interface OsmQueryOptions {
  tables?: ('point' | 'line' | 'polygon')[];
  conditions: OsmKeyValue[];
  bbox?: [number, number, number, number];
  limit?: number;
  offset?: number;
  columns?: string[];
}

export interface CreateOsmTableOptions {
  schema: string;
  table: string;
  sourceTable: 'planet_osm_point' | 'planet_osm_line' | 'planet_osm_polygon';
  conditions: OsmKeyValue[];
  bbox?: [number, number, number, number];
  boundaryTable?: string;
  boundaryId?: number;
  boundaryGeomColumn?: string;
}

export interface OsmTableStats {
  count: number;
  totalArea: number | null;
  totalLength: number | null;
  numPoints: number;
}

export class OsmQueryService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Build a WHERE clause from key/value conditions for planet_osm tables.
   * OSM columns in osm2pgsql use column names matching OSM keys.
   */
  private buildWhereClause(conditions: OsmKeyValue[], tableAlias = ''): { clause: string; params: unknown[] } {
    if (conditions.length === 0) {
      return { clause: 'TRUE', params: [] };
    }

    const prefix = tableAlias ? `${tableAlias}.` : '';
    const parts: string[] = [];
    const params: unknown[] = [];

    for (const cond of conditions) {
      const col = this.sanitizeIdentifier(cond.key);
      if (cond.value === '*') {
        // Any non-null value
        parts.push(`${prefix}"${col}" IS NOT NULL`);
      } else {
        parts.push(`${prefix}"${col}" = $${params.length + 1}`);
        params.push(cond.value);
      }
    }

    return { clause: parts.join(' AND '), params };
  }

  /**
   * Query OSM data and return GeoJSON features.
   */
  private async getTableColumns(tableName: string): Promise<Set<string>> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${this.sanitizeIdentifier(tableName)}' AND table_schema = 'osm'`
      );
      return new Set(rows.map(r => r.column_name));
    } catch {
      return new Set();
    }
  }

  /**
   * Query OSM data and return GeoJSON features.
   */
  async queryFeatures(options: OsmQueryOptions): Promise<GeoJSONFeatureCollection> {
    const tables = options.tables ?? ['point', 'polygon'];
    const selectColumns = options.columns?.length
      ? options.columns.map(c => `"${this.sanitizeIdentifier(c)}"`).join(', ') + ', '
      : '"name", ';

    const unions: string[] = [];
    for (const t of tables) {
      const tableName = `planet_osm_${t}`;
      const existingColumns = await this.getTableColumns(tableName);
      const whereInline = this.buildWhereInline(options.conditions, existingColumns);
      const geomExpr = t === 'polygon'
        ? 'ST_Centroid(ST_Transform(way, 4326))'
        : 'ST_Transform(way, 4326)';
      const tagsExpr = existingColumns.has('tags') ? 'hstore_to_json(tags) AS tags, ' : '';

      // osm_id::text - un bigint Postgres devient un BigInt JS non sérialisable en JSON tel quel.
      let sql = `SELECT osm_id::text AS osm_id, ${selectColumns} ${tagsExpr}ST_AsGeoJSON(${geomExpr})::json AS geometry FROM osm.${tableName} WHERE (${whereInline})`;

      if (options.bbox) {
        const [minLon, minLat, maxLon, maxLat] = options.bbox;
        sql += ` AND way && ST_Transform(ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326), 3857)`;
      }

      unions.push(sql);
    }

    let fullSql = unions.join(' UNION ALL ');
    if (options.limit) fullSql += ` LIMIT ${Number(options.limit)}`;
    if (options.offset) fullSql += ` OFFSET ${Number(options.offset)}`;

    logger.debug('OSM query', { sql: fullSql });

    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(fullSql);

    const features: GeoJSONFeature[] = rows.map(row => {
      const { osm_id, geometry, ...rest } = row;
      return {
        type: 'Feature',
        geometry: geometry as Record<string, unknown>,
        properties: { osm_id, ...rest as Record<string, unknown> },
      };
    });

    return { type: 'FeatureCollection', features };
  }

  /**
   * Create a PostGIS table derived from OSM data using CREATE TABLE AS SELECT.
   */
  async createTable(options: CreateOsmTableOptions): Promise<OsmTableStats> {
    const schema = this.sanitizeIdentifier(options.schema);
    const table = this.sanitizeIdentifier(options.table);
    
    // Get existing columns of source table to prevent querying missing columns
    const existingColumns = await this.getTableColumns(options.sourceTable);
    const whereInline = this.buildWhereInline(options.conditions, existingColumns);

    // Determine geometry expression based on source table
    const geomExpr = 'ST_Transform(A.way, 4326) AS geometry';
    // Inclure les tags OSM bruts (hstore -> json) quand la table source en dispose,
    // pour permettre l'enrichissement des fiches descriptives (horaires, contacts...).
    const sourceColumns = await this.getTableColumns(options.sourceTable);
    const tagsCol = sourceColumns.has('tags') ? 'hstore_to_json(A.tags)::jsonb AS tags, ' : '';
    // Colonnes dédiées ajoutées via le style osm2pgsql personnalisé (voir
    // scripts d'import) - sélectionnées seulement si présentes sur la source,
    // pour rester compatible avec des tables important via le style par défaut.
    const enrichmentColumns = [
      'opening_hours', 'phone', 'contact:phone', 'website', 'contact:website',
      'email', 'contact:email', 'addr:housenumber', 'addr:street', 'addr:city',
    ].filter((c) => sourceColumns.has(c));
    const enrichmentCols = enrichmentColumns.length
      ? enrichmentColumns.map((c) => `A."${c}"`).join(', ') + ', '
      : '';
    const selectCols = `A.osm_id, A."name", ${tagsCol}${enrichmentCols}${geomExpr}`;

    let fromClause = `osm.${options.sourceTable} AS A`;
    let spatialFilter = '';

    if (options.boundaryTable && options.boundaryId != null) {
      const boundaryTable = this.sanitizeIdentifier(options.boundaryTable);
      const geomCol = this.sanitizeIdentifier(options.boundaryGeomColumn ?? 'geom');
      fromClause += `, ${boundaryTable} AS B`;

      if (options.sourceTable === 'planet_osm_polygon') {
        spatialFilter = ` AND B.id = ${Number(options.boundaryId)} AND ST_Contains(ST_Transform(B."${geomCol}", 4326), ST_Transform(A.way, 4326))`;
      } else {
        spatialFilter = ` AND B.id = ${Number(options.boundaryId)} AND ST_Intersects(ST_Transform(A.way, 4326), ST_Transform(B."${geomCol}", 4326))`;
      }
    }

    if (options.bbox) {
      const [minLon, minLat, maxLon, maxLat] = options.bbox;
      spatialFilter += ` AND A.way && ST_Transform(ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326), 3857)`;
    }

    const selectSql = `SELECT ${selectCols} FROM ${fromClause} WHERE (${whereInline})${spatialFilter}`;

    // Create schema if not exists
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    // Drop existing table
    await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schema}"."${table}"`);

    // Create table as select
    await this.prisma.$executeRawUnsafe(`CREATE TABLE "${schema}"."${table}" AS ${selectSql}`);

    // Rename geometry column to geom
    try {
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."${table}" RENAME COLUMN geometry TO geom`);
    } catch {
      // Column might already be named geom
    }

    // Create spatial index
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "${table}_geom_idx" ON "${schema}"."${table}" USING GIST(geom)`
    );

    // Compute stats
    return this.getTableStats(schema, table, options.sourceTable);
  }

  /**
   * Get statistics for a created OSM-derived table.
   */
  async getTableStats(schema: string, table: string, sourceType?: string): Promise<OsmTableStats> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);

    let statsSql: string;
    if (sourceType === 'planet_osm_polygon') {
      statsSql = `SELECT COUNT(*)::integer AS count, COALESCE(SUM(ST_Area(ST_Transform(geom, 32632)) / 1000000), 0)::double precision AS total_area, NULL::double precision AS total_length, COALESCE(SUM(ST_NPoints(geom)), 0)::integer AS num_points FROM "${s}"."${t}"`;
    } else if (sourceType === 'planet_osm_line') {
      statsSql = `SELECT COUNT(*)::integer AS count, NULL::double precision AS total_area, COALESCE(SUM(ST_Length(geography(geom))) / 1000, 0)::double precision AS total_length, COALESCE(SUM(ST_NPoints(geom)), 0)::integer AS num_points FROM "${s}"."${t}"`;
    } else {
      statsSql = `SELECT COUNT(*)::integer AS count, NULL::double precision AS total_area, NULL::double precision AS total_length, 0 AS num_points FROM "${s}"."${t}"`;
    }

    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(statsSql);
    const row = rows[0] || {};

    return {
      count: Number(row.count) || 0,
      totalArea: row.total_area != null ? Number(row.total_area) : null,
      totalLength: row.total_length != null ? Number(row.total_length) : null,
      numPoints: Number(row.num_points) || 0,
    };
  }

  /**
   * Build inline WHERE (escaping values to prevent SQL injection).
   */
  private buildWhereInline(conditions: OsmKeyValue[], existingColumns?: Set<string>): string {
    if (conditions.length === 0) return 'TRUE';

    return conditions.map(cond => {
      const col = this.sanitizeIdentifier(cond.key);
      if (existingColumns && !existingColumns.has(col)) {
        logger.warn(`Column "${col}" does not exist in the source OSM table. Treating condition as FALSE.`);
        return 'FALSE';
      }
      if (cond.value === '*') {
        return `"${col}" IS NOT NULL`;
      }
      const safeValue = cond.value.replace(/'/g, "''");
      return `"${col}" = '${safeValue}'`;
    }).join(' AND ');
  }

  private sanitizeIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '');
  }
}
