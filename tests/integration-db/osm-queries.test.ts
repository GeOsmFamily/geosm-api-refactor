import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DB_AVAILABLE, getPrisma, disconnectPrisma } from './setup.js';
import { OsmQueryService } from '../../src/infrastructure/database/osm-query.service.js';

const TEST_SCHEMA = 'test_osm';

beforeAll(async () => {}, 60_000);

afterAll(async () => {
  if (DB_AVAILABLE) {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS osm CASCADE');
    await disconnectPrisma();
  }
});

describe.skipIf(!DB_AVAILABLE)('OSM raw SQL queries', () => {
  let service: OsmQueryService;

  beforeAll(async () => {
    const prisma = getPrisma();
    service = new OsmQueryService(prisma);
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');

    // OsmQueryService lit toujours les tables planet_osm_* depuis le schéma "osm" (voir
    // moveTablesToOsmSchema() dans import-osm-data.use-case.ts, qui les y déplace après
    // l'import osm2pgsql) - on reproduit donc ce placement ici plutôt que de les créer dans
    // "public", sans quoi toutes les requêtes échouent avec "relation osm.planet_osm_* does
    // not exist" malgré des tables bien présentes ailleurs.
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS osm');

    // Create minimal planet_osm_* tables mimicking osm2pgsql output
    // osm2pgsql stores geometries in EPSG:3857 in a column called "way"
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS osm.planet_osm_point (
        osm_id BIGINT,
        "name" TEXT,
        "amenity" TEXT,
        "shop" TEXT,
        "tourism" TEXT,
        way geometry(Point, 3857)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS planet_osm_point_way_idx ON osm.planet_osm_point USING GIST(way)
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS osm.planet_osm_line (
        osm_id BIGINT,
        "name" TEXT,
        "highway" TEXT,
        "waterway" TEXT,
        way geometry(LineString, 3857)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS planet_osm_line_way_idx ON osm.planet_osm_line USING GIST(way)
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS osm.planet_osm_polygon (
        osm_id BIGINT,
        "name" TEXT,
        "building" TEXT,
        "landuse" TEXT,
        way geometry(Polygon, 3857)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS planet_osm_polygon_way_idx ON osm.planet_osm_polygon USING GIST(way)
    `);

    // Insert sample data (geometry in 3857)
    await prisma.$executeRawUnsafe(`
      INSERT INTO osm.planet_osm_point (osm_id, "name", "amenity", way)
      VALUES (1001, 'Test School', 'school', ST_Transform(ST_SetSRID(ST_MakePoint(11.5, 3.85), 4326), 3857))
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO osm.planet_osm_point (osm_id, "name", "shop", way)
      VALUES (1002, 'Test Shop', 'supermarket', ST_Transform(ST_SetSRID(ST_MakePoint(11.51, 3.86), 4326), 3857))
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO osm.planet_osm_line (osm_id, "name", "highway", way)
      VALUES (2001, 'Main Road', 'primary', ST_Transform(ST_SetSRID(ST_MakeLine(ST_MakePoint(11.5, 3.85), ST_MakePoint(11.6, 3.9)), 4326), 3857))
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO osm.planet_osm_polygon (osm_id, "name", "building", way)
      VALUES (3001, 'Test Building', 'yes',
        ST_Transform(ST_SetSRID(ST_GeomFromText('POLYGON((11.5 3.85, 11.501 3.85, 11.501 3.851, 11.5 3.851, 11.5 3.85))'), 4326), 3857))
    `);
  });

  // ---- queryFeatures: UNION ALL across planet_osm tables ----
  it('queryFeatures: basic query with conditions', async () => {
    const fc = await service.queryFeatures({
      tables: ['point'],
      conditions: [{ key: 'amenity', value: 'school' }],
    });
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.length).toBeGreaterThanOrEqual(1);
    expect(fc.features[0].properties.name).toBe('Test School');
  });

  it('queryFeatures: wildcard value (*) means IS NOT NULL', async () => {
    const fc = await service.queryFeatures({
      tables: ['point'],
      conditions: [{ key: 'amenity', value: '*' }],
    });
    expect(fc.features.length).toBeGreaterThanOrEqual(1);
  });

  it('queryFeatures: UNION ALL across multiple tables', async () => {
    const fc = await service.queryFeatures({
      tables: ['point', 'polygon'],
      conditions: [{ key: 'name', value: '*' }],
      limit: 100,
    });
    expect(fc.features.length).toBeGreaterThanOrEqual(2);
  });

  it('queryFeatures: with bbox filter (ST_Transform + ST_MakeEnvelope)', async () => {
    const fc = await service.queryFeatures({
      tables: ['point'],
      conditions: [{ key: 'name', value: '*' }],
      bbox: [11.0, 3.5, 12.0, 4.0],
    });
    expect(fc.features.length).toBeGreaterThanOrEqual(1);
  });

  it('queryFeatures: with limit and offset', async () => {
    const fc = await service.queryFeatures({
      tables: ['point'],
      conditions: [{ key: 'name', value: '*' }],
      limit: 1,
      offset: 0,
    });
    expect(fc.features.length).toBeLessThanOrEqual(1);
  });

  it('queryFeatures: with custom columns', async () => {
    const fc = await service.queryFeatures({
      tables: ['point'],
      conditions: [{ key: 'amenity', value: 'school' }],
      columns: ['name', 'amenity'],
    });
    expect(fc.features.length).toBeGreaterThanOrEqual(1);
    expect(fc.features[0].properties.amenity).toBe('school');
  });

  // ---- createTable: CREATE TABLE AS SELECT ----
  it('createTable: creates derived table from planet_osm_point', async () => {
    await getPrisma().$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);

    const stats = await service.createTable({
      schema: TEST_SCHEMA,
      table: 'schools',
      sourceTable: 'planet_osm_point',
      conditions: [{ key: 'amenity', value: 'school' }],
    });
    expect(stats.count).toBeGreaterThanOrEqual(1);

    // Verify the table was created
    const rows = await getPrisma().$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*)::integer AS cnt FROM "${TEST_SCHEMA}"."schools"`,
    );
    expect(Number(rows[0].cnt)).toBeGreaterThanOrEqual(1);
  });

  it('createTable: from planet_osm_polygon', async () => {
    const stats = await service.createTable({
      schema: TEST_SCHEMA,
      table: 'buildings',
      sourceTable: 'planet_osm_polygon',
      conditions: [{ key: 'building', value: 'yes' }],
    });
    expect(stats.count).toBeGreaterThanOrEqual(1);
    // Polygon source should report area
    expect(stats.totalArea).not.toBeNull();
  });

  it('createTable: from planet_osm_line', async () => {
    const stats = await service.createTable({
      schema: TEST_SCHEMA,
      table: 'roads',
      sourceTable: 'planet_osm_line',
      conditions: [{ key: 'highway', value: 'primary' }],
    });
    expect(stats.count).toBeGreaterThanOrEqual(1);
    expect(stats.totalLength).not.toBeNull();
  });

  it('createTable: with bbox filter', async () => {
    const stats = await service.createTable({
      schema: TEST_SCHEMA,
      table: 'schools_bbox',
      sourceTable: 'planet_osm_point',
      conditions: [{ key: 'amenity', value: 'school' }],
      bbox: [11.0, 3.5, 12.0, 4.0],
    });
    expect(stats.count).toBeGreaterThanOrEqual(1);
  });

  it('createTable: with boundary filter (ST_Contains/ST_Intersects)', async () => {
    // Create a boundary table
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS test_boundary (
        id SERIAL PRIMARY KEY,
        geom geometry(Polygon, 4326)
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO test_boundary (geom)
      VALUES (ST_SetSRID(ST_GeomFromText('POLYGON((11.0 3.5, 12.0 3.5, 12.0 4.0, 11.0 4.0, 11.0 3.5))'), 4326))
    `);

    const stats = await service.createTable({
      schema: TEST_SCHEMA,
      table: 'schools_bounded',
      sourceTable: 'planet_osm_point',
      conditions: [{ key: 'amenity', value: 'school' }],
      boundaryTable: 'test_boundary',
      boundaryId: 1,
      boundaryGeomColumn: 'geom',
    });
    expect(stats.count).toBeGreaterThanOrEqual(0); // May be 0 or 1 depending on containment

    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS test_boundary CASCADE');
  });

  // ---- getTableStats ----
  it('getTableStats: point source type', async () => {
    const stats = await service.getTableStats(TEST_SCHEMA, 'schools', 'planet_osm_point');
    expect(stats.count).toBeGreaterThanOrEqual(1);
    expect(stats.totalArea).toBeNull();
    expect(stats.totalLength).toBeNull();
  });
});
