/* eslint-disable no-console */
// Seed idempotent de l'arbre territorial (continents + pays). Rejouable sans risque :
//   npm run db:seed:territories
import { PrismaClient } from '@prisma/client';
import { seedTerritories } from '../prisma/territories.js';

const prisma = new PrismaClient();

seedTerritories(prisma)
  .then((r) => {
    console.log(
      `Territoires : ${r.continentsCreated} continent(s) cree(s), ` +
        `${r.countriesCreated} pays cree(s), ${r.countriesUpdated} pays mis a jour`,
    );
  })
  .catch((e) => {
    console.error('Seed des territoires en echec :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
