/* eslint-disable no-console */
// Seed idempotent de l'arbre territorial (continents + pays). Rejouable sans risque :
//   npm run db:seed:territories
import { PrismaClient } from '@prisma/client';
import { seedTerritories } from '../prisma/territories.js';
import { seedPredefinedComments } from '../prisma/predefined-comments.js';
import { seedPostTags } from '../prisma/post-tags.js';

const prisma = new PrismaClient();

seedTerritories(prisma)
  .then(async (r) => {
    console.log(
      `Territoires : ${r.continentsCreated} continent(s) cree(s), ` +
        `${r.countriesCreated} pays cree(s), ${r.countriesUpdated} pays mis a jour`,
    );
    const seeded = await seedPredefinedComments(prisma);
    console.log(`Commentaires predefinis : ${seeded} pays initialise(s)`);
    const tags = await seedPostTags(prisma);
    console.log(`Etiquettes : ${tags.sdg} ODD, etiquettes libres pour ${tags.custom} pays`);
  })
  .catch((e) => {
    console.error('Seed des territoires en echec :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
