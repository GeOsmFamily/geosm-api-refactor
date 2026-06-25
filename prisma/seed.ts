import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const DEFAULT_THEMES = [
  { name: 'Transport', icon: 'directions_bus', color: '#1565C0', tags: ['Routes', 'Gares', 'Aeroports', 'Ports'] },
  { name: 'Sante', icon: 'local_hospital', color: '#C62828', tags: ['Hopitaux', 'Cliniques', 'Pharmacies', 'Centres de sante'] },
  { name: 'Education', icon: 'school', color: '#2E7D32', tags: ['Ecoles', 'Universites', 'Centres de formation', 'Bibliotheques'] },
  { name: 'Eau et Assainissement', icon: 'water_drop', color: '#0277BD', tags: ['Points d eau', 'Forages', 'Assainissement'] },
  { name: 'Energie', icon: 'bolt', color: '#F57F17', tags: ['Electricite', 'Solaire', 'Postes de transformation'] },
  { name: 'Agriculture', icon: 'agriculture', color: '#33691E', tags: ['Cultures', 'Elevage', 'Peche'] },
  { name: 'Environnement', icon: 'park', color: '#1B5E20', tags: ['Forets', 'Aires protegees', 'Zones humides'] },
  { name: 'Administration', icon: 'account_balance', color: '#4A148C', tags: ['Mairies', 'Prefectures', 'Ministeres'] },
  { name: 'Commerce', icon: 'store', color: '#E65100', tags: ['Marches', 'Centres commerciaux', 'Banques'] },
  { name: 'Tourisme', icon: 'tour', color: '#00695C', tags: ['Hotels', 'Sites touristiques', 'Restaurants'] },
  { name: 'Securite', icon: 'shield', color: '#37474F', tags: ['Police', 'Gendarmerie', 'Pompiers'] },
  { name: 'Urbanisme', icon: 'location_city', color: '#5D4037', tags: ['Batiments', 'Parcelles', 'Voirie', 'Limites administratives'] },
];

const DEFAULT_BASEMAPS = [
  { name: 'OpenStreetMap', slug: 'openstreetmap', type: 'XYZ' as const, url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '(c) OpenStreetMap contributors', isDefault: true, order: 0 },
  { name: 'Satellite (Esri)', slug: 'satellite-esri', type: 'XYZ' as const, url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '(c) Esri', isDefault: false, order: 1 },
  { name: 'OpenTopoMap', slug: 'opentopomap', type: 'XYZ' as const, url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '(c) OpenTopoMap', isDefault: false, order: 2 },
];

function slugify(input: string): string {
  return input.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function main(): Promise<void> {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@geosm.org';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'AdminP@ssw0rd!';
  const adminFirstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Super';
  const adminLastName = process.env.SUPER_ADMIN_LAST_NAME || 'Admin';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.create({
      data: {
        id: uuidv4(),
        email: adminEmail,
        passwordHash,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  for (const theme of DEFAULT_THEMES) {
    const slug = slugify(theme.name);
    const existing = await prisma.defaultTheme.findUnique({ where: { slug } });
    if (!existing) {
      const themeRecord = await prisma.defaultTheme.create({
        data: {
          id: uuidv4(),
          name: theme.name,
          slug,
          icon: theme.icon,
          color: theme.color,
          order: DEFAULT_THEMES.indexOf(theme),
        },
      });

      for (const tagName of theme.tags) {
        await prisma.defaultTag.create({
          data: {
            id: uuidv4(),
            name: tagName,
            slug: slugify(tagName),
            themeId: themeRecord.id,
          },
        });
      }
    }
  }

  for (const bm of DEFAULT_BASEMAPS) {
    const existing = await prisma.baseMap.findFirst({ where: { slug: bm.slug, instanceId: null } });
    if (!existing) {
      await prisma.baseMap.create({
        data: {
          id: uuidv4(),
          name: bm.name,
          slug: bm.slug,
          type: bm.type,
          url: bm.url,
          attribution: bm.attribution,
          isDefault: bm.isDefault,
          order: bm.order,
          instanceId: null,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    process.stderr.write(`Seed error: ${e}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
