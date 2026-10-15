import { describe, it, expect } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  CONTINENTS,
  COUNTRIES,
  countrySlug,
  flagUrl,
  seedTerritories,
  slugify,
} from '../../../prisma/territories.js';

describe('donnees territoriales', () => {
  it('declare les six continents du cahier fonctionnel (RG-B-01)', () => {
    expect(CONTINENTS.map((c) => c.slug).sort()).toEqual(
      ['afrique', 'amerique-du-nord', 'amerique-du-sud', 'asie', 'europe', 'oceanie'].sort(),
    );
    expect(new Set(CONTINENTS.map((c) => c.code)).size).toBe(6);
  });

  it('liste les 54 pays africains', () => {
    expect(COUNTRIES.filter((c) => c.continent === 'afrique')).toHaveLength(54);
  });

  it('rattache chaque pays a un continent existant', () => {
    const slugs = new Set(CONTINENTS.map((c) => c.slug));
    for (const c of COUNTRIES) expect(slugs.has(c.continent), c.name).toBe(true);
  });

  it('n\'a ni doublon de code ISO ni doublon de slug (dont les slugs des continents)', () => {
    const iso = COUNTRIES.map((c) => c.iso);
    expect(new Set(iso).size).toBe(iso.length);
    const slugs = [...COUNTRIES.map(countrySlug), ...CONTINENTS.map((c) => c.slug)];
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('ouvre uniquement le Cameroun et conserve son slug historique (RG-B-04)', () => {
    const active = COUNTRIES.filter((c) => c.active);
    expect(active.map((c) => c.iso)).toEqual(['cm']);
    expect(countrySlug(active[0])).toBe('cameroon');
  });

  it('produit des slugs sans accent ni apostrophe', () => {
    expect(slugify("Côte d'Ivoire")).toBe('cote-d-ivoire');
    expect(slugify('Sao Tomé-et-Principe')).toBe('sao-tome-et-principe');
    for (const c of COUNTRIES) expect(countrySlug(c)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('construit l\'URL du drapeau', () => {
    expect(flagUrl('cm')).toBe('https://flagcdn.com/cm.svg');
  });
});

/** Faux client Prisma minimal : seul `instance` est utilise par le seed. */
function fakePrisma(initial: Array<{ slug: string; [k: string]: unknown }> = []) {
  const rows = new Map<string, Record<string, any>>(
    initial.map((r, i) => [r.slug, { id: `id-${i}`, ...r }]),
  );
  let seq = 1000;
  const instance = {
    findUnique: async ({ where }: any) => rows.get(where.slug) ?? null,
    create: async ({ data }: any) => {
      const row = { id: `id-${seq++}`, ...data };
      rows.set(data.slug, row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = [...rows.values()].find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
  };
  return { prisma: { instance } as unknown as PrismaClient, rows };
}

describe('seedTerritories', () => {
  it('cree continents et pays sur une base vide', async () => {
    const { prisma, rows } = fakePrisma();
    const result = await seedTerritories(prisma);

    expect(result.continentsCreated).toBe(6);
    expect(result.countriesCreated).toBe(COUNTRIES.length);
    expect(rows.size).toBe(6 + COUNTRIES.length);
    expect(rows.get('afrique')).toMatchObject({ kind: 'CONTINENT', continentCode: 'AF', isActive: false });
    expect(rows.get('tchad')).toMatchObject({
      kind: 'COUNTRY',
      continentCode: 'AF',
      parentInstanceId: rows.get('afrique')!.id,
      isActive: false,
      flagIconUrl: 'https://flagcdn.com/td.svg',
    });
    expect(rows.get('cameroon')).toMatchObject({ isActive: true });
  });

  it('est idempotent : un second passage ne cree rien', async () => {
    const { prisma, rows } = fakePrisma();
    await seedTerritories(prisma);
    const size = rows.size;

    const again = await seedTerritories(prisma);
    expect(again.continentsCreated).toBe(0);
    expect(again.countriesCreated).toBe(0);
    expect(again.countriesUpdated).toBe(COUNTRIES.length);
    expect(rows.size).toBe(size);
  });

  it('rattache le Cameroun existant sans toucher a ses donnees ni a son etat actif', async () => {
    const { prisma, rows } = fakePrisma([
      { slug: 'cameroon', name: 'GeOsm Cameroun', isActive: true, bbox: [8, 1, 17, 13], centerLat: 7.37 },
    ]);
    await seedTerritories(prisma);

    const cm = rows.get('cameroon')!;
    expect(cm.parentInstanceId).toBe(rows.get('afrique')!.id);
    expect(cm.continentCode).toBe('AF');
    expect(cm.flagIconUrl).toBe('https://flagcdn.com/cm.svg');
    expect(cm.name).toBe('GeOsm Cameroun');
    expect(cm.bbox).toEqual([8, 1, 17, 13]);
    expect(cm.centerLat).toBe(7.37);
    expect(cm.isActive).toBe(true);
  });

  it('ne reactive jamais un pays desactive par un administrateur', async () => {
    const { prisma, rows } = fakePrisma([{ slug: 'cameroon', name: 'Cameroun', isActive: false }]);
    await seedTerritories(prisma);
    expect(rows.get('cameroon')!.isActive).toBe(false);
  });
});
