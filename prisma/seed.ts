/* eslint-disable no-console */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { CreateInstanceUseCase } from '../src/application/use-cases/instances/create-instance.use-case.js';
import { PrismaInstanceRepository } from '../src/infrastructure/database/repositories/prisma-instance.repository.js';
import { PrismaGroupRepository } from '../src/infrastructure/database/repositories/prisma-group.repository.js';
import { PrismaSubGroupRepository } from '../src/infrastructure/database/repositories/prisma-sub-group.repository.js';
import { PrismaLayerRepository } from '../src/infrastructure/database/repositories/prisma-layer.repository.js';
import { OsmQueryService } from '../src/infrastructure/database/osm-query.service.js';
import { Osm2pgsqlService } from '../src/infrastructure/osm/osm2pgsql.service.js';
import { QGISProjectService } from '../src/infrastructure/qgis/qgis-project.service.js';
import { SvgGeneratorService } from '../src/infrastructure/utils/svg-generator.service.js';
import { PrismaQgisProjectRepository } from '../src/infrastructure/database/repositories/prisma-qgis-project.repository.js';
import { PrismaBaseMapRepository } from '../src/infrastructure/database/repositories/prisma-base-map.repository.js';

const prisma = new PrismaClient();
const execAsync = promisify(exec);

async function createMockOsmSchema(prismaClient: PrismaClient): Promise<void> {
  console.log('Creating mock OSM schema and data...');
  await prismaClient.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');
  await prismaClient.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS hstore');
  await prismaClient.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS osm');

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS osm.planet_osm_point (
      osm_id BIGINT,
      "name" TEXT,
      "amenity" TEXT,
      "healthcare" TEXT,
      "office" TEXT,
      "finance" TEXT,
      "service" TEXT,
      "leisure" TEXT,
      "man_made" TEXT,
      "shop" TEXT,
      "tourism" TEXT,
      "aeroway" TEXT,
      "railway" TEXT,
      "government" TEXT,
      tags hstore,
      way geometry(Point, 3857)
    )
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS osm.planet_osm_line (
      osm_id BIGINT,
      "name" TEXT,
      "highway" TEXT,
      "waterway" TEXT,
      tags hstore,
      way geometry(LineString, 3857)
    )
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS osm.planet_osm_polygon (
      osm_id BIGINT,
      "name" TEXT,
      "leisure" TEXT,
      "man_made" TEXT,
      "tourism" TEXT,
      "aeroway" TEXT,
      tags hstore,
      way geometry(Polygon, 3857)
    )
  `);

  // Un hôpital (Santé) - avec quelques tags OSM enrichis (horaires, contacts)
  await prismaClient.$executeRawUnsafe(`
    INSERT INTO osm.planet_osm_point (osm_id, "name", "amenity", tags, way)
    VALUES (101, 'Hôpital Général de Yaoundé', 'hospital',
      'opening_hours=>"24/7", phone=>"+237 222 23 40 20", website=>"https://hgy.cm", "addr:street"=>"Avenue Henri Dunant"'::hstore,
      ST_Transform(ST_SetSRID(ST_MakePoint(11.52, 3.86), 4326), 3857))
  `);

  // Une microfinance (Finance)
  await prismaClient.$executeRawUnsafe(`
    INSERT INTO osm.planet_osm_point (osm_id, "name", "office", "finance", tags, way)
    VALUES (102, 'Coopérative Epargne', 'financial', 'microcredit',
      'opening_hours=>"Mo-Fr 08:00-16:00", phone=>"+237 233 42 10 05"'::hstore,
      ST_Transform(ST_SetSRID(ST_MakePoint(11.51, 3.85), 4326), 3857))
  `);

  // Un aéroport (Automobile et Transport - POLYGON)
  await prismaClient.$executeRawUnsafe(`
    INSERT INTO osm.planet_osm_polygon (osm_id, "name", "aeroway", way)
    VALUES (201, 'Aéroport International de Yaoundé-Nsimalen', 'aerodrome', 
      ST_Transform(ST_SetSRID(ST_GeomFromText('POLYGON((11.54 3.80, 11.56 3.80, 11.56 3.82, 11.54 3.82, 11.54 3.80))'), 4326), 3857))
  `);

  // Un parc urbain (Environnement - POLYGON)
  await prismaClient.$executeRawUnsafe(`
    INSERT INTO osm.planet_osm_polygon (osm_id, "name", "leisure", way)
    VALUES (202, 'Parc National de Waza', 'park', 
      ST_Transform(ST_SetSRID(ST_GeomFromText('POLYGON((14.50 11.30, 14.70 11.30, 14.70 11.50, 14.50 11.50, 14.50 11.30))'), 4326), 3857))
  `);
}

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Déterminer le dossier de données et le chemin du fichier PBF
  const dataDir = fs.existsSync('/data') ? '/data' : './data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const pbfPath = path.join(dataDir, 'cameroon-latest.osm.pbf');

  // Vérifier si des données existent déjà dans planet_osm_* dans le schéma osm
  let hasRealData = false;
  try {
    const pointCount = await prisma.$queryRawUnsafe<{ count: number }[]>(
      'SELECT COUNT(*)::integer AS count FROM osm.planet_osm_point'
    );
    if (Number(pointCount[0]?.count) > 0) {
      hasRealData = true;
    }
  } catch {
    console.log("Les tables osm.planet_osm_* n'existent pas encore.");
  }

  if (hasRealData) {
    console.log('Données OSM déjà chargées dans les tables osm.planet_osm_*.');
  } else {
    console.log('Aucune donnée OSM détectée. Initialisation du téléchargement et import automatique...');
    
    if (fs.existsSync(pbfPath)) {
      console.log(`Le fichier PBF OSM existe déjà à l'emplacement ${pbfPath}.`);
    } else {
      console.log(`Téléchargement du PBF Cameroun depuis Geofabrik vers ${pbfPath}...`);
      try {
        await execAsync(`wget -O "${pbfPath}" https://download.geofabrik.de/africa/cameroon-latest.osm.pbf`);
      } catch (err) {
        console.log('Échec de wget, tentative avec curl...', err);
        try {
          await execAsync(`curl -L -o "${pbfPath}" https://download.geofabrik.de/africa/cameroon-latest.osm.pbf`);
        } catch (curlErr) {
          const errMsg = curlErr instanceof Error ? curlErr.message : String(curlErr);
          console.error('Échec du téléchargement du fichier PBF :', errMsg);
        }
      }
    }

    if (fs.existsSync(pbfPath)) {
      console.log('Importation des données OSM via osm2pgsql (cela peut prendre quelques minutes)...');
      const osm2pgsqlService = new Osm2pgsqlService();
      try {
        await osm2pgsqlService.importFile(pbfPath, { slim: true, cache: 800 });
        console.log('Importation osm2pgsql terminée avec succès.');

        // MOVE TABLES to osm schema to isolate them from public schema (preventing Prisma db push drop loop)
        console.log("Migration des tables planet_osm_* vers le schéma 'osm'...");
        await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS osm');
        for (const t of ['point', 'line', 'polygon', 'roads', 'nodes', 'ways', 'rels']) {
          await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS public.planet_osm_${t} SET SCHEMA osm`);
        }

        hasRealData = true;
      } catch (importErr) {
        const errMsg = importErr instanceof Error ? importErr.message : String(importErr);
        console.error('Échec de l\'importation osm2pgsql :', errMsg);
      }
    }

    if (!hasRealData) {
      console.log('Repli (Fallback) sur la création de schéma et données de test OSM locales...');
      await createMockOsmSchema(prisma);
    }
  }

  // Super admin
  const passwordHash = await argon2.hash(
    process.env.SUPER_ADMIN_PASSWORD || 'AdminP@ssw0rd!',
    {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    },
  );

  const admin = await prisma.user.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL || 'admin@geosm.org' },
    update: {},
    create: {
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@geosm.org',
      passwordHash,
      firstName: process.env.SUPER_ADMIN_FIRST_NAME || 'Super',
      lastName: process.env.SUPER_ADMIN_LAST_NAME || 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Admin user created: ${admin.email}`);

  // Delete existing Cameroon instance to allow full recreation
  const existingInstance = await prisma.instance.findUnique({ where: { slug: 'cameroon' } });
  if (existingInstance) {
    console.log('Deleting existing Cameroon instance and dropping its schema...');
    await prisma.instance.delete({ where: { slug: 'cameroon' } });
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "cameroon" CASCADE`);
  }

  // Demo instance
  const instance = await prisma.instance.create({
    data: {
      name: JSON.stringify({ fr: 'Cameroun', en: 'Cameroon' }),
      slug: 'cameroon',
      description: JSON.stringify({ fr: 'Instance GeOSM Cameroun', en: 'GeOSM Cameroon instance' }),
      bbox: [8.4, 1.6, 16.2, 13.1],
      centerLat: 7.37,
      centerLon: 12.35,
      defaultZoom: 6,
      isActive: true,
    },
  });
  console.log(`Instance created: ${instance.name}`);

  // Chargement du MNT SRTM (profil altimétrique) pour l'emprise de l'instance - voir
  // scripts/import-srtm.sh. Ne fait jamais échouer le seed : sans MNT, seul l'outil
  // altimétrie est indisponible, le reste du géoportail fonctionne normalement.
  const instanceBbox = instance.bbox as number[];
  if (instanceBbox && instanceBbox.length === 4) {
    console.log('Chargement du MNT SRTM pour le profil altimétrique (cela peut prendre plusieurs minutes)...');
    try {
      const [minLon, minLat, maxLon, maxLat] = instanceBbox;
      const { stdout } = await execAsync(
        `bash scripts/import-srtm.sh ${minLon} ${minLat} ${maxLon} ${maxLat}`,
        { env: { ...process.env }, maxBuffer: 1024 * 1024 * 20 },
      );
      console.log(stdout);
    } catch (srtmErr) {
      const errMsg = srtmErr instanceof Error ? srtmErr.message : String(srtmErr);
      console.warn('Échec du chargement SRTM (le profil altimétrique restera indisponible) :', errMsg);
    }
  }

  // Add admin to instance
  await prisma.instanceUser.upsert({
    where: {
      userId_instanceId: { userId: admin.id, instanceId: instance.id },
    },
    update: {},
    create: { userId: admin.id, instanceId: instance.id, role: 'SUPER_ADMIN' },
  });

  // Initialiser les couches par défaut et charger les données OSM
  console.log('Initializing default layers and importing OSM data for Cameroon (this might take a moment)...');
  const instanceRepository = new PrismaInstanceRepository(prisma);
  const groupRepository = new PrismaGroupRepository(prisma);
  const subGroupRepository = new PrismaSubGroupRepository(prisma);
  const layerRepository = new PrismaLayerRepository(prisma);
  const osmQueryService = new OsmQueryService(prisma);

  const createInstanceUseCase = new CreateInstanceUseCase(
    instanceRepository,
    groupRepository,
    subGroupRepository,
    layerRepository,
    osmQueryService,
    new QGISProjectService(),
    new SvgGeneratorService(),
    new PrismaQgisProjectRepository(prisma),
    new PrismaBaseMapRepository(prisma),
  );

  await createInstanceUseCase.initializeInstanceData(
    instance.id,
    instance.slug,
    instance.bbox,
    instance.boundaryTable,
    instance.boundaryId,
    instance.boundaryGeomCol,
  );
  console.log('Default layers initialized and OSM data imported successfully.');

  // Default themes
  const themes = [
    {
      name: 'Santé',
      slug: 'sante',
      icon: 'local_hospital',
      color: '#e74c3c',
      order: 1,
    },
    {
      name: 'Éducation',
      slug: 'education',
      icon: 'school',
      color: '#3498db',
      order: 2,
    },
    {
      name: 'Eau et Assainissement',
      slug: 'eau-assainissement',
      icon: 'water_drop',
      color: '#1abc9c',
      order: 3,
    },
  ];

  for (const t of themes) {
    await prisma.defaultTheme.upsert({
      where: { slug: t.slug },
      update: {},
      create: t,
    });
  }
  console.log('Default themes created');

  // Base maps (no unique constraint on slug, use findFirst + create)
  const baseMaps = [
    {
      name: 'OpenStreetMap',
      slug: 'osm',
      type: 'XYZ' as const,
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      isDefault: true,
      order: 1,
    },
    {
      name: 'Satellite',
      slug: 'satellite',
      type: 'XYZ' as const,
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
      isDefault: false,
      order: 2,
    },
  ];

  for (const bm of baseMaps) {
    const existing = await prisma.baseMap.findFirst({
      where: { name: bm.name, instanceId: instance.id },
    });
    if (!existing) {
      await prisma.baseMap.create({
        data: { ...bm, instanceId: instance.id },
      });
    }
  }
  console.log('Base maps created');

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
