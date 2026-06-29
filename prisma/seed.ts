/* eslint-disable no-console */
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
      name_fr: 'Santé',
      name_en: 'Health',
      name: JSON.stringify({ fr: 'Santé', en: 'Health' }),
      slug: 'sante',
      icon: 'local_hospital',
      color: '#e74c3c',
      order: 1,
    },
    {
      name_fr: 'Éducation',
      name_en: 'Education',
      name: JSON.stringify({ fr: 'Éducation', en: 'Education' }),
      slug: 'education',
      icon: 'school',
      color: '#3498db',
      order: 2,
    },
    {
      name_fr: 'Transport',
      name_en: 'Transport',
      name: JSON.stringify({ fr: 'Transport', en: 'Transport' }),
      slug: 'transport',
      icon: 'directions_bus',
      color: '#2ecc71',
      order: 3,
    },
    {
      name_fr: 'Environnement',
      name_en: 'Environment',
      name: JSON.stringify({ fr: 'Environnement', en: 'Environment' }),
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
      create: {
        name: g.name,
        slug: g.slug,
        icon: g.icon,
        color: g.color,
        order: g.order,
        instanceId: instance.id,
        isActive: true,
      },
    });

    // Create a default sub-group per group
    const subGroup = await prisma.subGroup.upsert({
      where: {
        slug_groupId: { slug: `${g.slug}-default`, groupId: group.id },
      },
      update: {},
      create: {
        name: JSON.stringify({ fr: `${g.name_fr} - Général`, en: `${g.name_en} - General` }),
        slug: `${g.slug}-default`,
        order: 0,
        isActive: true,
        groupId: group.id,
      },
    });

    // Seed a layer for this subgroup
    let layerName = '';
    let layerDesc = '';
    let geomType: 'POINT' | 'LINESTRING' | 'POLYGON' = 'POINT';
    let layerSlug = '';

    if (g.slug === 'sante') {
      layerName = JSON.stringify({ fr: 'Hôpitaux', en: 'Hospitals' });
      layerDesc = JSON.stringify({ fr: 'Liste des hôpitaux et centres de santé', en: 'List of hospitals and health centers' });
      layerSlug = 'hopitaux';
    } else if (g.slug === 'education') {
      layerName = JSON.stringify({ fr: 'Écoles', en: 'Schools' });
      layerDesc = JSON.stringify({ fr: 'Établissements scolaires primaires et secondaires', en: 'Primary and secondary school facilities' });
      layerSlug = 'ecoles';
    } else if (g.slug === 'transport') {
      layerName = JSON.stringify({ fr: 'Réseau Routier', en: 'Road Network' });
      layerDesc = JSON.stringify({ fr: 'Axes routiers majeurs et secondaires', en: 'Major and secondary highways' });
      geomType = 'LINESTRING';
      layerSlug = 'routes';
    } else if (g.slug === 'environnement') {
      layerName = JSON.stringify({ fr: 'Zones Protégées', en: 'Protected Areas' });
      layerDesc = JSON.stringify({ fr: 'Parcs nationaux et forêts classées', en: 'National parks and reserves' });
      geomType = 'POLYGON';
      layerSlug = 'zones-protegees';
    }

    if (layerSlug) {
      await prisma.layer.upsert({
        where: {
          slug_instanceId: { slug: layerSlug, instanceId: instance.id }
        },
        update: {},
        create: {
          name: layerName,
          slug: layerSlug,
          description: layerDesc,
          geometryType: geomType,
          sourceType: 'WMS',
          sourceUrl: 'https://geoserver.geosm.org/geoserver/wms',
          sourceLayer: `cameroon:${layerSlug}`,
          tableName: layerSlug,
          schemaName: 'public',
          isVisible: true,
          isQueryable: true,
          opacity: 1,
          order: 1,
          subGroupId: subGroup.id,
          instanceId: instance.id
        }
      });
    }
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

(async () => {
  try {
    await main();
  } catch (e) {
    console.error('Seed failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
