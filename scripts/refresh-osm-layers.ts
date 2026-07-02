/* eslint-disable no-console */
/**
 * Rafraîchit les tables PostGIS dérivées OSM de toutes les couches par défaut
 * d'une instance (recrée chaque table depuis osm.planet_osm_* à jour).
 * Usage: DATABASE_URL=... npx tsx scripts/refresh-osm-layers.ts <instance-slug>
 */
import { PrismaClient } from '@prisma/client';
import { OsmQueryService, CreateOsmTableOptions } from '../src/infrastructure/database/osm-query.service.js';
import { defaultLayers } from '../src/domain/constants/default-layers.constants.js';
import { GeometryType } from '../src/domain/enums.js';

const prisma = new PrismaClient();
const osmQueryService = new OsmQueryService(prisma);

async function main(): Promise<void> {
  const slug = process.argv[2] || 'cameroon';
  const instance = await prisma.instance.findUnique({ where: { slug } });
  if (!instance) {
    console.error(`Instance "${slug}" not found`);
    process.exit(1);
  }

  const layers = await prisma.layer.findMany({ where: { instanceId: instance.id } });
  console.log(`Found ${layers.length} layer(s) for instance "${slug}".`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const layerConfig of defaultLayers) {
    const dbLayer = layers.find((l) => l.slug === `${slug}-${layerConfig.slug}`);
    if (!dbLayer) {
      console.log(`  [skip] no DB layer matching slug "${slug}-${layerConfig.slug}"`);
      skipped++;
      continue;
    }

    let sourceTable: 'planet_osm_point' | 'planet_osm_line' | 'planet_osm_polygon' = 'planet_osm_point';
    if (layerConfig.geometryType === GeometryType.POLYGON) sourceTable = 'planet_osm_polygon';
    else if (layerConfig.geometryType === GeometryType.LINESTRING) sourceTable = 'planet_osm_line';

    const conditions = layerConfig.tagsOsm.split(';').map((part) => {
      const [key, value] = part.split('=');
      return { key: key.trim(), value: (value ?? '*').trim() };
    });

    const options: CreateOsmTableOptions = {
      schema: slug,
      table: dbLayer.tableName!,
      sourceTable,
      conditions,
    };
    if (instance.boundaryTable && instance.boundaryId != null) {
      options.boundaryTable = instance.boundaryTable;
      options.boundaryId = instance.boundaryId;
      options.boundaryGeomColumn = instance.boundaryGeomCol ?? 'geom';
    } else if (instance.bbox && instance.bbox.length === 4) {
      options.bbox = instance.bbox as [number, number, number, number];
    }

    try {
      const stats = await osmQueryService.createTable(options);
      await prisma.layer.update({
        where: { id: dbLayer.id },
        data: {
          metadata: {
            ...(dbLayer.metadata as object),
            featureCount: stats.count,
            totalArea: stats.totalArea,
            totalLength: stats.totalLength,
            importedAt: new Date().toISOString(),
          },
        },
      });
      console.log(`  [ok] ${dbLayer.tableName} -> ${stats.count} features`);
      success++;
    } catch (err) {
      console.error(`  [FAIL] ${dbLayer.tableName}:`, (err as Error).message);
      failed++;
    }
  }

  console.log(`\nDone. success=${success} skipped=${skipped} failed=${failed}`);
}

main()
  .catch((e) => {
    console.error('Refresh failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
