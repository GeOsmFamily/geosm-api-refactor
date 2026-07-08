/* eslint-disable no-console */
/**
 * Ajoute les fonds de carte par défaut (OSM Dark, France Topo, Mapbox Streets)
 * à toutes les instances existantes qui ne les ont pas encore.
 * Idempotent : peut être relancé sans dupliquer les fonds déjà présents.
 *
 * Usage: npm run db:backfill-basemaps
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { defaultBaseMaps } from '../src/domain/constants/default-basemaps.constants.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const instances = await prisma.instance.findMany({ select: { id: true, slug: true } });
  console.log(`Found ${instances.length} instance(s).`);

  for (const instance of instances) {
    for (const bm of defaultBaseMaps) {
      const existing = await prisma.baseMap.findFirst({
        where: { instanceId: instance.id, slug: bm.slug },
      });
      if (existing) {
        console.log(`  [skip] ${instance.slug} already has "${bm.slug}"`);
        continue;
      }

      await prisma.baseMap.create({
        data: {
          id: randomUUID(),
          name: bm.name,
          slug: bm.slug,
          type: bm.type,
          url: bm.url,
          attribution: bm.attribution,
          isDefault: bm.isDefault,
          order: bm.order,
          config: bm.config ?? undefined,
          instanceId: instance.id,
        },
      });
      console.log(`  [created] ${instance.slug} <- "${bm.slug}"`);
    }
  }

  console.log('Backfill completed.');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
