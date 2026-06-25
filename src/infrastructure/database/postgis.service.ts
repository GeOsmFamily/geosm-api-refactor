import { PrismaClient } from '@prisma/client';
import { logger } from '../observability/logger.js';

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface SpatialQueryOptions {
  schema: string;
  table: string;
  columns?: string[];
  where?: string;
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  limit?: number;
  offset?: number;
  srid?: number;
}

export interface LayerStats {
  featureCount: number;
  totalArea: number | null;  // in km²
  totalLength: number | null; // in km
  bbox: [number, number, number, number] | null;
}

export class PostGISService {
  constructor(private readonly prisma: PrismaClient) {}

  // Create a schema for a thematic group
  async createSchema(schemaName: string): Promise<void> {
    const safeName = this.sanitizeIdentifier(schemaName);
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${safeName}"`);
    logger.info('Schema created', { schema: safeName });
  }

  // Drop a schema
  async dropSchema(schemaName: string): Promise<void> {
    const safeName = this.sanitizeIdentifier(schemaName);
    await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${safeName}" CASCADE`);
    logger.info('Schema dropped', { schema: safeName });
  }

  // Create a spatial table for a layer
  async createSpatialTable(schema: string, table: string, geometryType: string, srid: number = 4326): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    const gType = geometryType.toUpperCase();

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${s}"."${t}" (
        id SERIAL PRIMARY KEY,
        geom geometry(${gType}, ${srid}),
        properties JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_${t}_geom" ON "${s}"."${t}" USING GIST (geom)
    `);

    logger.info('Spatial table created', { schema: s, table: t, geometryType: gType });
  }

  // Drop a spatial table
  async dropSpatialTable(schema: string, table: string): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${s}"."${t}" CASCADE`);
  }

  // Add a column to a spatial table
  async addColumn(schema: string, table: string, columnName: string, columnType: string = 'TEXT'): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    const c = this.sanitizeIdentifier(columnName);
    const validTypes = ['TEXT', 'INTEGER', 'BIGINT', 'DOUBLE PRECISION', 'BOOLEAN', 'TIMESTAMPTZ', 'JSONB', 'NUMERIC'];
    const safeType = validTypes.includes(columnType.toUpperCase()) ? columnType.toUpperCase() : 'TEXT';
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "${s}"."${t}" ADD COLUMN IF NOT EXISTS "${c}" ${safeType}`);
  }

  // Drop a column
  async dropColumn(schema: string, table: string, columnName: string): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    const c = this.sanitizeIdentifier(columnName);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "${s}"."${t}" DROP COLUMN IF EXISTS "${c}"`);
  }

  // Insert a GeoJSON feature into a spatial table
  async insertFeature(schema: string, table: string, feature: GeoJSONFeature, columns?: string[]): Promise<number> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    const geojsonStr = JSON.stringify(feature.geometry);

    if (columns && columns.length > 0) {
      const colNames = columns.map(c => `"${this.sanitizeIdentifier(c)}"`).join(', ');
      const colValues = columns.map(c => {
        const val = feature.properties[c];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return String(val);
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        return `'${String(val).replace(/'/g, "''")}'`;
      }).join(', ');

      const result = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO "${s}"."${t}" (geom, ${colNames}) VALUES (ST_SetSRID(ST_GeomFromGeoJSON('${geojsonStr}'), 4326), ${colValues}) RETURNING id`
      );
      return result[0]?.id ?? 0;
    }

    const result = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO "${s}"."${t}" (geom, properties) VALUES (ST_SetSRID(ST_GeomFromGeoJSON('${geojsonStr}'), 4326), '${JSON.stringify(feature.properties).replace(/'/g, "''")}') RETURNING id`
    );
    return result[0]?.id ?? 0;
  }

  // Bulk insert GeoJSON features
  async insertFeatures(schema: string, table: string, features: GeoJSONFeature[], columns?: string[]): Promise<number> {
    let count = 0;
    // Use transaction for bulk insert
    await this.prisma.$transaction(async (tx) => {
      for (const feature of features) {
        const s = this.sanitizeIdentifier(schema);
        const t = this.sanitizeIdentifier(table);
        const geojsonStr = JSON.stringify(feature.geometry);

        if (columns && columns.length > 0) {
          const colNames = columns.map(c => `"${this.sanitizeIdentifier(c)}"`).join(', ');
          const colValues = columns.map(c => {
            const val = feature.properties[c];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return String(val);
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');
          await tx.$executeRawUnsafe(
            `INSERT INTO "${s}"."${t}" (geom, ${colNames}) VALUES (ST_SetSRID(ST_GeomFromGeoJSON('${geojsonStr}'), 4326), ${colValues})`
          );
        } else {
          await tx.$executeRawUnsafe(
            `INSERT INTO "${s}"."${t}" (geom, properties) VALUES (ST_SetSRID(ST_GeomFromGeoJSON('${geojsonStr}'), 4326), '${JSON.stringify(feature.properties).replace(/'/g, "''")}')`
          );
        }
        count++;
      }
    });
    return count;
  }

  // Query features as GeoJSON
  async queryFeatures(options: SpatialQueryOptions): Promise<GeoJSONFeatureCollection> {
    const s = this.sanitizeIdentifier(options.schema);
    const t = this.sanitizeIdentifier(options.table);
    const srid = options.srid ?? 4326;

    let selectCols = `id, ST_AsGeoJSON(ST_Transform(geom, ${srid}))::json as geometry`;
    if (options.columns && options.columns.length > 0) {
      const cols = options.columns.map(c => `"${this.sanitizeIdentifier(c)}"`).join(', ');
      selectCols += `, ${cols}`;
    } else {
      selectCols += `, properties`;
    }

    let sql = `SELECT ${selectCols} FROM "${s}"."${t}" WHERE geom IS NOT NULL`;

    if (options.bbox) {
      const [minLon, minLat, maxLon, maxLat] = options.bbox;
      sql += ` AND geom && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)`;
    }

    if (options.where) {
      sql += ` AND (${options.where})`;
    }

    if (options.limit) sql += ` LIMIT ${options.limit}`;
    if (options.offset) sql += ` OFFSET ${options.offset}`;

    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);

    const features: GeoJSONFeature[] = rows.map(row => {
      const { id, geometry, ...rest } = row;
      const props = rest.properties ? rest.properties as Record<string, unknown> : rest;
      return {
        type: 'Feature' as const,
        geometry: geometry as Record<string, unknown>,
        properties: { id, ...props as Record<string, unknown> },
      };
    });

    return { type: 'FeatureCollection', features };
  }

  // Get layer statistics (count, area, length, bbox)
  async getLayerStats(schema: string, table: string): Promise<LayerStats> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);

    const result = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        COUNT(*)::integer as feature_count,
        CASE WHEN GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON')
          THEN ROUND(SUM(ST_Area(ST_Transform(geom, 32632)) / 1000000)::numeric, 2)
          ELSE NULL END as total_area,
        CASE WHEN GeometryType(geom) IN ('LINESTRING', 'MULTILINESTRING')
          THEN ROUND(SUM(ST_Length(ST_Transform(geom, 32632)) / 1000)::numeric, 2)
          ELSE NULL END as total_length,
        ST_XMin(ST_Extent(geom)) as xmin,
        ST_YMin(ST_Extent(geom)) as ymin,
        ST_XMax(ST_Extent(geom)) as xmax,
        ST_YMax(ST_Extent(geom)) as ymax
      FROM "${s}"."${t}"
      WHERE geom IS NOT NULL
    `);

    const row = result[0] || {};
    return {
      featureCount: Number(row.feature_count) || 0,
      totalArea: row.total_area ? Number(row.total_area) : null,
      totalLength: row.total_length ? Number(row.total_length) : null,
      bbox: row.xmin != null ? [Number(row.xmin), Number(row.ymin), Number(row.xmax), Number(row.ymax)] : null,
    };
  }

  // Spatial query: find features within a boundary
  async findFeaturesWithin(schema: string, table: string, boundaryGeojson: string, columns?: string[]): Promise<GeoJSONFeatureCollection> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);

    let selectCols = `a.id, ST_AsGeoJSON(a.geom)::json as geometry`;
    if (columns && columns.length > 0) {
      selectCols += ', ' + columns.map(c => `a."${this.sanitizeIdentifier(c)}"`).join(', ');
    } else {
      selectCols += `, a.properties`;
    }

    const safeGeojson = boundaryGeojson.replace(/'/g, "''");
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT ${selectCols}
      FROM "${s}"."${t}" a
      WHERE ST_Contains(
        ST_SetSRID(ST_GeomFromGeoJSON('${safeGeojson}'), 4326),
        CASE WHEN GeometryType(a.geom) = 'POINT' THEN a.geom ELSE ST_Centroid(a.geom) END
      )
    `);

    const features: GeoJSONFeature[] = rows.map(row => {
      const { id, geometry, ...rest } = row;
      return {
        type: 'Feature' as const,
        geometry: geometry as Record<string, unknown>,
        properties: { id, ...rest as Record<string, unknown> },
      };
    });

    return { type: 'FeatureCollection', features };
  }

  // Get feature by ID with GeoJSON geometry
  async getFeatureById(schema: string, table: string, featureId: number, columns?: string[]): Promise<GeoJSONFeature | null> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);

    let selectCols = `id, ST_AsGeoJSON(geom)::json as geometry`;
    if (columns && columns.length > 0) {
      selectCols += ', ' + columns.map(c => `"${this.sanitizeIdentifier(c)}"`).join(', ');
    } else {
      selectCols += `, properties`;
    }

    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${selectCols} FROM "${s}"."${t}" WHERE id = ${Number(featureId)}`
    );

    if (rows.length === 0) return null;
    const row = rows[0];
    const { id, geometry, ...rest } = row;
    return {
      type: 'Feature',
      geometry: geometry as Record<string, unknown>,
      properties: { id, ...rest as Record<string, unknown> },
    };
  }

  // Update a feature's geometry
  async updateFeatureGeometry(schema: string, table: string, featureId: number, geojsonGeometry: string): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    const safeGeojson = geojsonGeometry.replace(/'/g, "''");
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${s}"."${t}" SET geom = ST_SetSRID(ST_GeomFromGeoJSON('${safeGeojson}'), 4326), updated_at = NOW() WHERE id = ${Number(featureId)}`
    );
  }

  // Update feature attributes
  async updateFeatureAttributes(schema: string, table: string, featureId: number, attributes: Record<string, unknown>): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    const setClauses = Object.entries(attributes).map(([key, val]) => {
      const col = this.sanitizeIdentifier(key);
      if (val === null) return `"${col}" = NULL`;
      if (typeof val === 'number') return `"${col}" = ${val}`;
      if (typeof val === 'boolean') return `"${col}" = ${val}`;
      return `"${col}" = '${String(val).replace(/'/g, "''")}'`;
    }).join(', ');
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${s}"."${t}" SET ${setClauses}, updated_at = NOW() WHERE id = ${Number(featureId)}`
    );
  }

  // Delete a feature
  async deleteFeature(schema: string, table: string, featureId: number): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    await this.prisma.$executeRawUnsafe(`DELETE FROM "${s}"."${t}" WHERE id = ${Number(featureId)}`);
  }

  // Truncate a spatial table
  async truncateTable(schema: string, table: string): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${s}"."${t}" RESTART IDENTITY`);
  }

  // Get columns of a table
  async getTableColumns(schema: string, table: string): Promise<{ name: string; type: string }[]> {
    const rows = await this.prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = '${schema.replace(/'/g, "''")}' AND table_name = '${table.replace(/'/g, "''")}'
      ORDER BY ordinal_position
    `);
    return rows.map(r => ({ name: r.column_name, type: r.data_type }));
  }

  // Check if schema exists
  async schemaExists(schemaName: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = '${schemaName.replace(/'/g, "''")}')`
    );
    return rows[0]?.exists ?? false;
  }

  // Check if table exists
  async tableExists(schema: string, table: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = '${schema.replace(/'/g, "''")}' AND table_name = '${table.replace(/'/g, "''")}')`
    );
    return rows[0]?.exists ?? false;
  }

  // Get altitude from SRTM raster at a point
  async getAltitude(lon: number, lat: number): Promise<number | null> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ altitude: number }[]>(`
        SELECT ST_Value(rast, ST_SetSRID(ST_MakePoint(${Number(lon)}, ${Number(lat)}), 4326)) as altitude
        FROM srtm
        WHERE ST_Intersects(rast, ST_SetSRID(ST_MakePoint(${Number(lon)}, ${Number(lat)}), 4326))
        LIMIT 1
      `);
      return rows[0]?.altitude ?? null;
    } catch {
      return null;
    }
  }

  // Drape a line on elevation (elevation profile)
  async drapeElevationProfile(lineGeojson: string, numPoints: number = 100): Promise<{ distance: number; altitude: number }[]> {
    try {
      const safeGeojson = lineGeojson.replace(/'/g, "''");
      const rows = await this.prisma.$queryRawUnsafe<{ fraction: number; altitude: number }[]>(`
        WITH line AS (
          SELECT ST_SetSRID(ST_GeomFromGeoJSON('${safeGeojson}'), 4326) as geom
        ),
        points AS (
          SELECT generate_series(0, ${Number(numPoints)}) / ${Number(numPoints)}::float as fraction
        )
        SELECT
          p.fraction,
          COALESCE(ST_Value(s.rast, ST_LineInterpolatePoint(l.geom, p.fraction)), 0) as altitude
        FROM points p
        CROSS JOIN line l
        LEFT JOIN srtm s ON ST_Intersects(s.rast, ST_LineInterpolatePoint(l.geom, p.fraction))
      `);

      return rows.map(r => ({
        distance: Number(r.fraction),
        altitude: Number(r.altitude) || 0,
      }));
    } catch {
      return [];
    }
  }

  // Delete a column from a table
  async deleteColumn(schema: string, table: string, column: string): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    const c = this.sanitizeIdentifier(column);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "${s}"."${t}" DROP COLUMN IF EXISTS "${c}"`);
    logger.info('Column deleted', { schema: s, table: t, column: c });
  }

  // Update (rename/alter type) a column
  async updateColumn(schema: string, table: string, oldName: string, newName: string, newType?: string): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    const oldCol = this.sanitizeIdentifier(oldName);
    const newCol = this.sanitizeIdentifier(newName);

    if (oldCol !== newCol) {
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "${s}"."${t}" RENAME COLUMN "${oldCol}" TO "${newCol}"`);
    }

    if (newType) {
      const validTypes = ['TEXT', 'INTEGER', 'BIGINT', 'DOUBLE PRECISION', 'BOOLEAN', 'TIMESTAMPTZ', 'JSONB', 'NUMERIC', 'VARCHAR', 'REAL'];
      const safeType = validTypes.find(vt => vt === newType.toUpperCase()) ?? 'TEXT';
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "${s}"."${t}" ALTER COLUMN "${newCol}" TYPE ${safeType} USING "${newCol}"::${safeType}`);
    }

    logger.info('Column updated', { schema: s, table: t, oldName: oldCol, newName: newCol, newType });
  }

  // Set primary display field via column comment
  async setPrimaryDisplayField(schema: string, table: string, column: string): Promise<void> {
    const s = this.sanitizeIdentifier(schema);
    const t = this.sanitizeIdentifier(table);
    const c = this.sanitizeIdentifier(column);

    // Remove existing primary display markers
    const cols = await this.listColumns(s, t);
    for (const col of cols) {
      if (col.comment?.includes('PRIMARY_DISPLAY')) {
        await this.prisma.$executeRawUnsafe(`COMMENT ON COLUMN "${s}"."${t}"."${col.name}" IS NULL`);
      }
    }

    await this.prisma.$executeRawUnsafe(`COMMENT ON COLUMN "${s}"."${t}"."${c}" IS 'PRIMARY_DISPLAY'`);
    logger.info('Primary display field set', { schema: s, table: t, column: c });
  }

  // List columns with names, types, constraints, and comments
  async listColumns(schema: string, table: string): Promise<{ name: string; type: string; nullable: boolean; defaultValue: string | null; comment: string | null }[]> {
    const safeSchema = schema.replace(/'/g, "''");
    const safeTable = table.replace(/'/g, "''");

    const rows = await this.prisma.$queryRawUnsafe<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      description: string | null;
    }[]>(`
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        pgd.description
      FROM information_schema.columns c
      LEFT JOIN pg_catalog.pg_statio_all_tables st
        ON st.schemaname = c.table_schema AND st.relname = c.table_name
      LEFT JOIN pg_catalog.pg_description pgd
        ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
      WHERE c.table_schema = '${safeSchema}' AND c.table_name = '${safeTable}'
      ORDER BY c.ordinal_position
    `);

    return rows.map(r => ({
      name: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable === 'YES',
      defaultValue: r.column_default,
      comment: r.description,
    }));
  }

  // Sanitize SQL identifiers to prevent injection
  private sanitizeIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '');
  }
}
