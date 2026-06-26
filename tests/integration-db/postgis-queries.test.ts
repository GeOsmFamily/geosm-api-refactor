import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DB_AVAILABLE, getPrisma,  disconnectPrisma } from './setup.js';
import { PostGISService, GeoJSONFeature } from '../../src/infrastructure/database/postgis.service.js';
import { SpatialAnalysisUseCase } from '../../src/application/use-cases/analysis/spatial-analysis.use-case.js';

const TEST_SCHEMA = 'test_postgis';

beforeAll(async () => {
}, 60_000);

afterAll(async () => {
  if (DB_AVAILABLE) {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await disconnectPrisma();
  }
});

describe.skipIf(!DB_AVAILABLE)('PostGIS raw SQL queries', () => {
  let service: PostGISService;
  const TABLE = 'test_features';

  beforeAll(async () => {
    service = new PostGISService(getPrisma());
    // Ensure PostGIS extension
    await getPrisma().$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');
  });

  // ---- createSchema ----
  it('createSchema: CREATE SCHEMA IF NOT EXISTS', async () => {
    await service.createSchema(TEST_SCHEMA);
    const exists = await service.schemaExists(TEST_SCHEMA);
    expect(exists).toBe(true);
  });

  // ---- createSpatialTable ----
  it('createSpatialTable: CREATE TABLE with geometry column and GIST index', async () => {
    await service.createSpatialTable(TEST_SCHEMA, TABLE, 'POINT');
    const exists = await service.tableExists(TEST_SCHEMA, TABLE);
    expect(exists).toBe(true);
  });

  // ---- addColumn ----
  it('addColumn: ALTER TABLE ADD COLUMN IF NOT EXISTS', async () => {
    await service.addColumn(TEST_SCHEMA, TABLE, 'label', 'TEXT');
    const cols = await service.getTableColumns(TEST_SCHEMA, TABLE);
    expect(cols.some(c => c.name === 'label')).toBe(true);
  });

  // ---- insertFeature (with properties) ----
  it('insertFeature: INSERT with ST_GeomFromGeoJSON (properties path)', async () => {
    const feature: GeoJSONFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [11.5, 3.85] },
      properties: { name: 'Yaounde' },
    };
    const id = await service.insertFeature(TEST_SCHEMA, TABLE, feature);
    expect(id).toBeGreaterThan(0);
  });

  // ---- insertFeature (with columns) ----
  it('insertFeature: INSERT with extra columns', async () => {
    const feature: GeoJSONFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [9.7, 4.05] },
      properties: { label: 'Douala' },
    };
    const id = await service.insertFeature(TEST_SCHEMA, TABLE, feature, ['label']);
    expect(id).toBeGreaterThan(0);
  });

  // ---- insertFeatures (bulk) ----
  it('insertFeatures: bulk insert in transaction', async () => {
    const features: GeoJSONFeature[] = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [10.0, 5.0] }, properties: { label: 'A' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [10.1, 5.1] }, properties: { label: 'B' } },
    ];
    const count = await service.insertFeatures(TEST_SCHEMA, TABLE, features, ['label']);
    expect(count).toBe(2);
  });

  // ---- queryFeatures ----
  it('queryFeatures: SELECT with ST_AsGeoJSON', async () => {
    const fc = await service.queryFeatures({ schema: TEST_SCHEMA, table: TABLE });
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.length).toBeGreaterThan(0);
    expect(fc.features[0].geometry).toBeDefined();
  });

  // ---- queryFeatures with bbox ----
  it('queryFeatures: with bbox filter (ST_MakeEnvelope)', async () => {
    const fc = await service.queryFeatures({
      schema: TEST_SCHEMA,
      table: TABLE,
      bbox: [11.0, 3.5, 12.0, 4.5],
      limit: 10,
    });
    expect(fc.type).toBe('FeatureCollection');
    // Should find the Yaounde point
    expect(fc.features.length).toBeGreaterThanOrEqual(1);
  });

  // ---- queryFeatures with columns and where ----
  it('queryFeatures: with columns and where clause', async () => {
    const fc = await service.queryFeatures({
      schema: TEST_SCHEMA,
      table: TABLE,
      columns: ['label'],
      where: `"label" = 'Douala'`,
      limit: 5,
    });
    expect(fc.features.length).toBeGreaterThanOrEqual(1);
  });

  // ---- getFeatureById ----
  it('getFeatureById: SELECT ... WHERE id = N', async () => {
    const feature: GeoJSONFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [12.0, 4.0] },
      properties: { name: 'test-get' },
    };
    const id = await service.insertFeature(TEST_SCHEMA, TABLE, feature);
    const found = await service.getFeatureById(TEST_SCHEMA, TABLE, id);
    expect(found).not.toBeNull();
    expect(found!.geometry).toBeDefined();
  });

  // ---- updateFeatureGeometry ----
  it('updateFeatureGeometry: UPDATE SET geom = ST_SetSRID(ST_GeomFromGeoJSON(...))', async () => {
    const feature: GeoJSONFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.0, 3.0] },
      properties: {},
    };
    const id = await service.insertFeature(TEST_SCHEMA, TABLE, feature);
    const newGeom = JSON.stringify({ type: 'Point', coordinates: [11.0, 4.0] });
    await service.updateFeatureGeometry(TEST_SCHEMA, TABLE, id, newGeom);

    const updated = await service.getFeatureById(TEST_SCHEMA, TABLE, id);
    expect(updated).not.toBeNull();
  });

  // ---- updateFeatureAttributes ----
  it('updateFeatureAttributes: UPDATE SET col = val', async () => {
    const feature: GeoJSONFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.0, 3.0] },
      properties: { label: 'before' },
    };
    const id = await service.insertFeature(TEST_SCHEMA, TABLE, feature, ['label']);
    await service.updateFeatureAttributes(TEST_SCHEMA, TABLE, id, { label: 'after' });

    const fc = await service.queryFeatures({
      schema: TEST_SCHEMA,
      table: TABLE,
      columns: ['label'],
      where: `id = ${id}`,
    });
    expect(fc.features[0].properties.label).toBe('after');
  });

  // ---- deleteFeature ----
  it('deleteFeature: DELETE WHERE id = N', async () => {
    const feature: GeoJSONFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.0, 3.0] },
      properties: {},
    };
    const id = await service.insertFeature(TEST_SCHEMA, TABLE, feature);
    await service.deleteFeature(TEST_SCHEMA, TABLE, id);
    const found = await service.getFeatureById(TEST_SCHEMA, TABLE, id);
    expect(found).toBeNull();
  });

  // ---- truncateTable ----
  it('truncateTable: TRUNCATE TABLE ... RESTART IDENTITY', async () => {
    // Insert one feature so table is non-empty
    await service.insertFeature(TEST_SCHEMA, TABLE, {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.0, 3.0] },
      properties: {},
    });
    await service.truncateTable(TEST_SCHEMA, TABLE);
    const fc = await service.queryFeatures({ schema: TEST_SCHEMA, table: TABLE });
    expect(fc.features).toHaveLength(0);
  });

  // ---- getLayerStats ----
  it('getLayerStats: aggregate query with ST_Area, ST_Length, ST_Extent', async () => {
    // Create a polygon table for meaningful stats
    const polyTable = 'test_polygons';
    await service.createSpatialTable(TEST_SCHEMA, polyTable, 'POLYGON');
    const poly: GeoJSONFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[11.0, 3.0], [11.1, 3.0], [11.1, 3.1], [11.0, 3.1], [11.0, 3.0]]],
      },
      properties: {},
    };
    await service.insertFeature(TEST_SCHEMA, polyTable, poly);
    const stats = await service.getLayerStats(TEST_SCHEMA, polyTable);
    expect(stats.featureCount).toBe(1);
    expect(stats.bbox).not.toBeNull();
    expect(stats.totalArea).not.toBeNull();
    await service.dropSpatialTable(TEST_SCHEMA, polyTable);
  });

  // ---- findFeaturesWithin ----
  it('findFeaturesWithin: ST_Contains spatial query', async () => {
    await service.insertFeature(TEST_SCHEMA, TABLE, {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [11.5, 3.85] },
      properties: {},
    });
    const boundaryGeojson = JSON.stringify({
      type: 'Polygon',
      coordinates: [[[11.0, 3.0], [12.0, 3.0], [12.0, 4.5], [11.0, 4.5], [11.0, 3.0]]],
    });
    const fc = await service.findFeaturesWithin(TEST_SCHEMA, TABLE, boundaryGeojson);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.length).toBeGreaterThanOrEqual(1);
  });

  // ---- getTableColumns ----
  it('getTableColumns: information_schema.columns query', async () => {
    const cols = await service.getTableColumns(TEST_SCHEMA, TABLE);
    expect(cols.length).toBeGreaterThan(0);
    expect(cols.some(c => c.name === 'id')).toBe(true);
    expect(cols.some(c => c.name === 'geom')).toBe(true);
  });

  // ---- schemaExists ----
  it('schemaExists: information_schema.schemata query', async () => {
    expect(await service.schemaExists(TEST_SCHEMA)).toBe(true);
    expect(await service.schemaExists('nonexistent_schema_xyz')).toBe(false);
  });

  // ---- tableExists ----
  it('tableExists: information_schema.tables query', async () => {
    expect(await service.tableExists(TEST_SCHEMA, TABLE)).toBe(true);
    expect(await service.tableExists(TEST_SCHEMA, 'nonexistent_table')).toBe(false);
  });

  // ---- dropColumn ----
  it('dropColumn: ALTER TABLE DROP COLUMN IF EXISTS', async () => {
    await service.addColumn(TEST_SCHEMA, TABLE, 'temp_col', 'TEXT');
    await service.dropColumn(TEST_SCHEMA, TABLE, 'temp_col');
    const cols = await service.getTableColumns(TEST_SCHEMA, TABLE);
    expect(cols.some(c => c.name === 'temp_col')).toBe(false);
  });

  // ---- updateColumn (rename + alter type) ----
  it('updateColumn: ALTER TABLE RENAME COLUMN + ALTER COLUMN TYPE', async () => {
    await service.addColumn(TEST_SCHEMA, TABLE, 'rename_me', 'TEXT');
    await service.updateColumn(TEST_SCHEMA, TABLE, 'rename_me', 'renamed_col', 'INTEGER');
    const cols = await service.getTableColumns(TEST_SCHEMA, TABLE);
    expect(cols.some(c => c.name === 'renamed_col')).toBe(true);
    await service.dropColumn(TEST_SCHEMA, TABLE, 'renamed_col');
  });

  // ---- deleteColumn ----
  it('deleteColumn: ALTER TABLE DROP COLUMN IF EXISTS (alias)', async () => {
    await service.addColumn(TEST_SCHEMA, TABLE, 'delete_me', 'TEXT');
    await service.deleteColumn(TEST_SCHEMA, TABLE, 'delete_me');
    const cols = await service.getTableColumns(TEST_SCHEMA, TABLE);
    expect(cols.some(c => c.name === 'delete_me')).toBe(false);
  });

  // ---- listColumns ----
  it('listColumns: information_schema + pg_description join', async () => {
    const cols = await service.listColumns(TEST_SCHEMA, TABLE);
    expect(cols.length).toBeGreaterThan(0);
    expect(cols[0]).toHaveProperty('name');
    expect(cols[0]).toHaveProperty('type');
    expect(cols[0]).toHaveProperty('nullable');
    expect(cols[0]).toHaveProperty('defaultValue');
    expect(cols[0]).toHaveProperty('comment');
  });

  // ---- setPrimaryDisplayField ----
  it('setPrimaryDisplayField: COMMENT ON COLUMN', async () => {
    await service.addColumn(TEST_SCHEMA, TABLE, 'display_field', 'TEXT');
    await service.setPrimaryDisplayField(TEST_SCHEMA, TABLE, 'display_field');
    const cols = await service.listColumns(TEST_SCHEMA, TABLE);
    const df = cols.find(c => c.name === 'display_field');
    expect(df?.comment).toContain('PRIMARY_DISPLAY');
    await service.dropColumn(TEST_SCHEMA, TABLE, 'display_field');
  });

  // ---- getAltitude ----
  it('getAltitude: ST_Value on srtm raster (returns null without data)', async () => {
    // This query will fail gracefully because the srtm table doesn't exist
    const alt = await service.getAltitude(11.5, 3.85);
    // Should return null, not throw
    expect(alt).toBeNull();
  });

  // ---- drapeElevationProfile ----
  it('drapeElevationProfile: CTE with ST_LineInterpolatePoint (returns empty without srtm)', async () => {
    const lineGeojson = JSON.stringify({
      type: 'LineString',
      coordinates: [[11.0, 3.0], [11.5, 3.5], [12.0, 4.0]],
    });
    const result = await service.drapeElevationProfile(lineGeojson, 5);
    // Should return empty array, not throw
    expect(Array.isArray(result)).toBe(true);
  });

  // ---- dropSpatialTable ----
  it('dropSpatialTable: DROP TABLE IF EXISTS CASCADE', async () => {
    await service.createSpatialTable(TEST_SCHEMA, 'drop_me', 'POINT');
    await service.dropSpatialTable(TEST_SCHEMA, 'drop_me');
    expect(await service.tableExists(TEST_SCHEMA, 'drop_me')).toBe(false);
  });

  // ---- dropSchema ----
  it('dropSchema: DROP SCHEMA IF EXISTS CASCADE', async () => {
    await service.createSchema('test_drop_schema');
    await service.dropSchema('test_drop_schema');
    expect(await service.schemaExists('test_drop_schema')).toBe(false);
  });
});

describe.skipIf(!DB_AVAILABLE)('SpatialAnalysisUseCase raw SQL', () => {
  let useCase: SpatialAnalysisUseCase;

  beforeAll(async () => {
    useCase = new SpatialAnalysisUseCase(getPrisma());
    await getPrisma().$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');
  });

  it('buffer: ST_Buffer with geography cast', async () => {
    const result = await useCase.execute({
      operation: 'buffer',
      geometryA: { type: 'Point', coordinates: [11.5, 3.85] },
      distance: 1000,
    });
    expect(result.geometry).toBeDefined();
    expect(result.type).toBe('buffer');
  });

  it('intersection: ST_Intersection of two polygons', async () => {
    const result = await useCase.execute({
      operation: 'intersection',
      geometryA: {
        type: 'Polygon',
        coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
      },
      geometryB: {
        type: 'Polygon',
        coordinates: [[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]],
      },
    });
    expect(result.geometry).toBeDefined();
  });

  it('union: ST_Union of two polygons', async () => {
    const result = await useCase.execute({
      operation: 'union',
      geometryA: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      },
      geometryB: {
        type: 'Polygon',
        coordinates: [[[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5], [0.5, 0.5]]],
      },
    });
    expect(result.geometry).toBeDefined();
  });

  it('difference: ST_Difference of two polygons', async () => {
    const result = await useCase.execute({
      operation: 'difference',
      geometryA: {
        type: 'Polygon',
        coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
      },
      geometryB: {
        type: 'Polygon',
        coordinates: [[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]],
      },
    });
    expect(result.geometry).toBeDefined();
  });
});
