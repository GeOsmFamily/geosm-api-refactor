import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DB_AVAILABLE, getPrisma,  disconnectPrisma } from './setup.js';
import { AdressageService } from '../../src/infrastructure/database/adressage.service.js';
import { ManageSequenceUseCase } from '../../src/application/use-cases/admin/manage-sequence.use-case.js';
import { FindAdminBoundaryUseCase } from '../../src/application/use-cases/geoportail/find-admin-boundary.use-case.js';
import { SearchLimitInTableUseCase } from '../../src/application/use-cases/geoportail/search-limit-in-table.use-case.js';
import { SaveCoordPdfUseCase } from '../../src/application/use-cases/maps/save-coord-pdf.use-case.js';

const TEST_SCHEMA = 'test_adressage';

beforeAll(async () => {
}, 60_000);

afterAll(async () => {
  if (DB_AVAILABLE) {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS adressage CASCADE');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS public.admin_boundaries CASCADE');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS public.coord_pdf_annotations CASCADE');
    await disconnectPrisma();
  }
});

describe.skipIf(!DB_AVAILABLE)('Adressage raw SQL queries', () => {
  let service: AdressageService;

  beforeAll(async () => {
    const prisma = getPrisma();
    service = new AdressageService(prisma);
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');

    // Create test schema and tables for adressage
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${TEST_SCHEMA}"."addresses" (
        id SERIAL PRIMARY KEY,
        geom geometry(Point, 4326),
        name TEXT,
        quartier TEXT
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${TEST_SCHEMA}"."addresses" (geom, name, quartier)
      VALUES (ST_SetSRID(ST_MakePoint(11.5, 3.85), 4326), 'Test Address', 'Centre')
    `);

    // Create adressage schema with minimal tables for the service methods
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS adressage');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS adressage.base_formate (
        id SERIAL PRIMARY KEY,
        arrondissement TEXT DEFAULT '',
        nom_voie TEXT DEFAULT '',
        point_adresse geometry(Point, 4326),
        designation_construct TEXT DEFAULT '',
        proprietaire TEXT DEFAULT '',
        quartier TEXT DEFAULT '',
        numero_porte TEXT DEFAULT '',
        designation_nature_occupation TEXT DEFAULT '',
        code_usage TEXT DEFAULT ''
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO adressage.base_formate
        (arrondissement, nom_voie, point_adresse, designation_construct, proprietaire, quartier, numero_porte, designation_nature_occupation, code_usage)
      VALUES
        ('Arr1', 'RUE PRINCIPALE', ST_SetSRID(ST_MakePoint(11.5, 3.85), 4326), 'Maison', 'Dupont', 'Centre', '42', 'Habitation', 'HAB')
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS adressage.code_usage (
        id SERIAL PRIMARY KEY,
        code TEXT,
        designation TEXT
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO adressage.code_usage (code, designation)
      VALUES ('HAB', 'Habitation')
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS adressage.voies (
        id_voie SERIAL PRIMARY KEY,
        nom TEXT,
        trace geography(LineString, 4326)
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO adressage.voies (nom, trace)
      VALUES ('Rue Principale', ST_GeogFromText('SRID=4326;LINESTRING(11.5 3.85, 11.501 3.851)'))
    `);
  });

  // ---- getAdresse: SELECT * with ST_Within ----
  it('getAdresse: ST_Within query runs without error', async () => {
    const polygon = 'POLYGON((11.49 3.84, 11.51 3.84, 11.51 3.86, 11.49 3.86, 11.49 3.84))';
    const results = await service.getAdresse(TEST_SCHEMA, 'addresses', polygon);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  // ---- getPoints: SELECT with ST_Intersects + ST_Buffer ----
  it('getPoints: ST_Buffer + ST_Intersects query runs without error', async () => {
    const results = await service.getPoints([11.5, 3.85], 'RUE PRINCIPALE');
    expect(Array.isArray(results)).toBe(true);
    // Should find the matching row
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  // ---- searchAdresse: SELECT with code_usage filter ----
  it('searchAdresse: filter by code_usage runs without error', async () => {
    const results = await service.searchAdresse('HAB');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  // ---- getAdresseByClick: ST_DWithin + ST_Distance on voies ----
  it('getAdresseByClick: ST_DWithin + ST_Distance query runs without error', async () => {
    // This will find the voie but the function call (adressage.founit_adresse_yde) won't exist
    // so we test the first query only
    const prisma = getPrisma();
    const voie = await prisma.$queryRawUnsafe<{ id_voie: number }[]>(
      `SELECT id_voie FROM adressage.voies WHERE ST_DWithin(trace, 'POINT(11.5 3.85)'::geography, 50) ORDER BY ST_Distance(trace, 'POINT(11.5 3.85)'::geography)`,
    );
    expect(Array.isArray(voie)).toBe(true);
    expect(voie.length).toBeGreaterThanOrEqual(1);
  });

  // ---- getCodeUsage: DISTINCT + code_usage lookup ----
  it('getCodeUsage: DISTINCT code_usage + code_usage table lookup', async () => {
    const results = await service.getCodeUsage();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0][0]).toHaveProperty('designation');
  });

  // ---- getElasticData: SELECT by id with ST_AsGeoJSON ----
  it('getElasticData: SELECT with ST_AsGeoJSON by id', async () => {
    const results = await service.getElasticData([
      { shema: TEST_SCHEMA, table: 'addresses', key_couche: 'test', id: 1 },
    ]);
    expect(Array.isArray(results)).toBe(true);
    // Row with id=1 should exist
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].geometry).toBeDefined();
  });
});

describe.skipIf(!DB_AVAILABLE)('ManageSequenceUseCase raw SQL', () => {
  let useCase: ManageSequenceUseCase;

  beforeAll(() => {
    useCase = new ManageSequenceUseCase(getPrisma());
  });

  afterAll(async () => {
    try {
      await getPrisma().$executeRawUnsafe('DROP SEQUENCE IF EXISTS "test_seq_integration"');
    } catch { /* ignore */ }
  });

  it('createSequence: CREATE SEQUENCE IF NOT EXISTS', async () => {
    const result = await useCase.createSequence('test_seq_integration', 1, 1);
    expect(result.name).toBe('test_seq_integration');
  });

  it('listSequences: information_schema.sequences query', async () => {
    const rows = await useCase.listSequences();
    expect(Array.isArray(rows)).toBe(true);
  });

  it('dropSequence: DROP SEQUENCE IF EXISTS', async () => {
    await useCase.createSequence('test_seq_drop', 1, 1);
    const result = await useCase.dropSequence('test_seq_drop');
    expect(result.dropped).toBe(true);
  });
});

describe.skipIf(!DB_AVAILABLE)('FindAdminBoundaryUseCase raw SQL', () => {
  let useCase: FindAdminBoundaryUseCase;

  beforeAll(async () => {
    const prisma = getPrisma();
    useCase = new FindAdminBoundaryUseCase(prisma);

    // Create admin_boundaries table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.admin_boundaries (
        id SERIAL PRIMARY KEY,
        name TEXT,
        admin_level INTEGER,
        geom geometry(Polygon, 4326)
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO public.admin_boundaries (name, admin_level, geom)
      VALUES ('Cameroon', 2, ST_SetSRID(ST_GeomFromText('POLYGON((8 1, 16 1, 16 13, 8 13, 8 1))'), 4326))
    `);
  });

  it('execute: ST_Contains query with parameterized lat/lon', async () => {
    const results = await useCase.execute(3.85, 11.5, 'public.admin_boundaries');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe('Cameroon');
  });
});

describe.skipIf(!DB_AVAILABLE)('SearchLimitInTableUseCase raw SQL', () => {
  let useCase: SearchLimitInTableUseCase;

  beforeAll(async () => {
    useCase = new SearchLimitInTableUseCase(getPrisma());
    // Uses the admin_boundaries table created above
  });

  it('execute: ST_Intersects + ST_Area ORDER query', async () => {
    const results = await useCase.execute('public.admin_boundaries', 3.85, 11.5);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!DB_AVAILABLE)('SaveCoordPdfUseCase raw SQL', () => {
  let useCase: SaveCoordPdfUseCase;

  beforeAll(async () => {
    const prisma = getPrisma();
    useCase = new SaveCoordPdfUseCase(prisma);

    // Create the coord_pdf_annotations table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.coord_pdf_annotations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        instance_id TEXT,
        coordinates JSONB,
        title TEXT,
        description TEXT,
        user_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  });

  it('execute: INSERT RETURNING with parameterized values', async () => {
    const result = await useCase.execute({
      instanceId: crypto.randomUUID(),
      coordinates: [{ lat: 3.85, lon: 11.5 }],
      title: 'Test PDF',
      description: 'A test',
      userId: crypto.randomUUID(),
    });
    expect(result.id).toBeDefined();
    expect(result.coordinates).toHaveLength(1);
  });
});
