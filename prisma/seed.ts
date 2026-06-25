import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

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

  // Demo instance
  const instance = await prisma.instance.upsert({
    where: { slug: 'cameroon' },
    update: {},
    create: {
      name: 'Cameroon',
      slug: 'cameroon',
      description: 'GeOSM Cameroon instance',
      bbox: [8.4, 1.6, 16.2, 13.1],
      centerLat: 7.37,
      centerLon: 12.35,
      defaultZoom: 6,
      isActive: true,
    },
  });
  console.log(`Instance created: ${instance.name}`);

  // Add admin to instance
  await prisma.instanceUser.upsert({
    where: {
      userId_instanceId: { userId: admin.id, instanceId: instance.id },
    },
    update: {},
    create: { userId: admin.id, instanceId: instance.id, role: 'SUPER_ADMIN' },
  });

  // Groups
  const groups = [
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
      name: 'Transport',
      slug: 'transport',
      icon: 'directions_bus',
      color: '#2ecc71',
      order: 3,
    },
    {
      name: 'Environnement',
      slug: 'environnement',
      icon: 'eco',
      color: '#27ae60',
      order: 4,
    },
  ];

  for (const g of groups) {
    const group = await prisma.group.upsert({
      where: {
        slug_instanceId: { slug: g.slug, instanceId: instance.id },
      },
      update: {},
      create: { ...g, instanceId: instance.id, isActive: true },
    });

    // Create a default sub-group per group
    await prisma.subGroup.upsert({
      where: {
        slug_groupId: { slug: `${g.slug}-default`, groupId: group.id },
      },
      update: {},
      create: {
        name: `${g.name} - Général`,
        slug: `${g.slug}-default`,
        order: 0,
        isActive: true,
        groupId: group.id,
      },
    });
  }
  console.log('Groups and sub-groups created');

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
  .finally(() => prisma.$disconnect());
