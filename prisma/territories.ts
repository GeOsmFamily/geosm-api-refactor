import type { PrismaClient } from '@prisma/client';

/**
 * Donnees territoriales de GeOsm Family : 6 continents et une liste de pays.
 *
 * Choix de lancement (cahier fonctionnel, question ouverte 3) : tout le continent africain est liste
 * (54 pays, tous « non disponibles » hors Cameroun) puis quelques pays par autre continent pour
 * donner corps au selecteur. Ajouter un pays = ajouter une ligne ici et relancer le seed.
 *
 * Le seed est IDEMPOTENT et ne supprime jamais rien : une instance existante n'est mise a jour que
 * sur sa place dans l'arbre (kind, parent, code continent, drapeau) ; ses donnees metier et son
 * etat actif ne sont pas touches.
 */
export interface ContinentSeed {
  slug: string;
  name: string;
  code: string;
}

export interface CountrySeed {
  /** Code ISO 3166-1 alpha-2, minuscules (sert au drapeau). */
  iso: string;
  name: string;
  continent: string;
  /** Slug existant a conserver (le Cameroun est `cameroon` depuis la v1). */
  slug?: string;
  /** Pays ouvert au lancement (RG-B-04). */
  active?: true;
}

export const CONTINENTS: ContinentSeed[] = [
  { slug: 'afrique', name: 'Afrique', code: 'AF' },
  { slug: 'europe', name: 'Europe', code: 'EU' },
  { slug: 'amerique-du-nord', name: 'Amérique du Nord', code: 'NA' },
  { slug: 'amerique-du-sud', name: 'Amérique du Sud', code: 'SA' },
  { slug: 'asie', name: 'Asie', code: 'AS' },
  { slug: 'oceanie', name: 'Océanie', code: 'OC' },
];

const africa = (iso: string, name: string, extra: Partial<CountrySeed> = {}): CountrySeed => ({
  iso,
  name,
  continent: 'afrique',
  ...extra,
});

export const COUNTRIES: CountrySeed[] = [
  africa('dz', 'Algérie'),
  africa('ao', 'Angola'),
  africa('bj', 'Bénin'),
  africa('bw', 'Botswana'),
  africa('bf', 'Burkina Faso'),
  africa('bi', 'Burundi'),
  africa('cv', 'Cap-Vert'),
  africa('cm', 'Cameroun', { slug: 'cameroon', active: true }),
  africa('cf', 'République centrafricaine'),
  africa('td', 'Tchad'),
  africa('km', 'Comores'),
  africa('cg', 'Congo'),
  africa('cd', 'République démocratique du Congo'),
  africa('ci', "Côte d'Ivoire"),
  africa('dj', 'Djibouti'),
  africa('eg', 'Égypte'),
  africa('gq', 'Guinée équatoriale'),
  africa('er', 'Érythrée'),
  africa('sz', 'Eswatini'),
  africa('et', 'Éthiopie'),
  africa('ga', 'Gabon'),
  africa('gm', 'Gambie'),
  africa('gh', 'Ghana'),
  africa('gn', 'Guinée'),
  africa('gw', 'Guinée-Bissau'),
  africa('ke', 'Kenya'),
  africa('ls', 'Lesotho'),
  africa('lr', 'Liberia'),
  africa('ly', 'Libye'),
  africa('mg', 'Madagascar'),
  africa('mw', 'Malawi'),
  africa('ml', 'Mali'),
  africa('mr', 'Mauritanie'),
  africa('mu', 'Maurice'),
  africa('ma', 'Maroc'),
  africa('mz', 'Mozambique'),
  africa('na', 'Namibie'),
  africa('ne', 'Niger'),
  africa('ng', 'Nigeria'),
  africa('rw', 'Rwanda'),
  africa('st', 'Sao Tomé-et-Principe'),
  africa('sn', 'Sénégal'),
  africa('sc', 'Seychelles'),
  africa('sl', 'Sierra Leone'),
  africa('so', 'Somalie'),
  africa('za', 'Afrique du Sud'),
  africa('ss', 'Soudan du Sud'),
  africa('sd', 'Soudan'),
  africa('tz', 'Tanzanie'),
  africa('tg', 'Togo'),
  africa('tn', 'Tunisie'),
  africa('ug', 'Ouganda'),
  africa('zm', 'Zambie'),
  africa('zw', 'Zimbabwe'),

  { iso: 'fr', name: 'France', continent: 'europe' },
  { iso: 'be', name: 'Belgique', continent: 'europe' },
  { iso: 'ch', name: 'Suisse', continent: 'europe' },
  { iso: 'de', name: 'Allemagne', continent: 'europe' },
  { iso: 'es', name: 'Espagne', continent: 'europe' },
  { iso: 'it', name: 'Italie', continent: 'europe' },
  { iso: 'ad', name: 'Andorre', continent: 'europe' },

  { iso: 'ca', name: 'Canada', continent: 'amerique-du-nord' },
  { iso: 'us', name: 'États-Unis', continent: 'amerique-du-nord' },
  { iso: 'mx', name: 'Mexique', continent: 'amerique-du-nord' },
  { iso: 'ht', name: 'Haïti', continent: 'amerique-du-nord' },

  { iso: 'br', name: 'Brésil', continent: 'amerique-du-sud' },
  { iso: 'ar', name: 'Argentine', continent: 'amerique-du-sud' },
  { iso: 'co', name: 'Colombie', continent: 'amerique-du-sud' },
  { iso: 'pe', name: 'Pérou', continent: 'amerique-du-sud' },

  { iso: 'cn', name: 'Chine', continent: 'asie' },
  { iso: 'in', name: 'Inde', continent: 'asie' },
  { iso: 'jp', name: 'Japon', continent: 'asie' },
  { iso: 'lb', name: 'Liban', continent: 'asie' },
  { iso: 'vn', name: 'Viêt Nam', continent: 'asie' },

  { iso: 'au', name: 'Australie', continent: 'oceanie' },
  { iso: 'nz', name: 'Nouvelle-Zélande', continent: 'oceanie' },
  { iso: 'fj', name: 'Fidji', continent: 'oceanie' },
];

/** `Côte d'Ivoire` -> `cote-d-ivoire`. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function countrySlug(country: CountrySeed): string {
  return country.slug ?? slugify(country.name);
}

export function flagUrl(iso: string): string {
  return `https://flagcdn.com/${iso}.svg`;
}

export interface TerritorySeedResult {
  continentsCreated: number;
  countriesCreated: number;
  countriesUpdated: number;
}

export async function seedTerritories(prisma: PrismaClient): Promise<TerritorySeedResult> {
  const result: TerritorySeedResult = { continentsCreated: 0, countriesCreated: 0, countriesUpdated: 0 };
  const continentIds = new Map<string, string>();

  for (const c of CONTINENTS) {
    const existing = await prisma.instance.findUnique({ where: { slug: c.slug } });
    if (existing) {
      await prisma.instance.update({
        where: { id: existing.id },
        data: { kind: 'CONTINENT', parentInstanceId: null, continentCode: c.code },
      });
      continentIds.set(c.slug, existing.id);
    } else {
      // Un continent n'est pas une carte : inactif, pour ne pas apparaitre dans les listes d'instances
      // actives du geoportail (il reste dans l'arbre territorial, qui ignore isActive).
      const created = await prisma.instance.create({
        data: { name: c.name, slug: c.slug, kind: 'CONTINENT', continentCode: c.code, isActive: false, bbox: [] },
      });
      continentIds.set(c.slug, created.id);
      result.continentsCreated++;
    }
  }

  for (const country of COUNTRIES) {
    const slug = countrySlug(country);
    const parentId = continentIds.get(country.continent)!;
    const code = CONTINENTS.find((c) => c.slug === country.continent)!.code;
    const placement = {
      kind: 'COUNTRY' as const,
      parentInstanceId: parentId,
      continentCode: code,
      flagIconUrl: flagUrl(country.iso),
    };

    const existing = await prisma.instance.findUnique({ where: { slug } });
    if (existing) {
      await prisma.instance.update({ where: { id: existing.id }, data: placement });
      result.countriesUpdated++;
    } else {
      await prisma.instance.create({
        data: { name: country.name, slug, bbox: [], isActive: country.active === true, ...placement },
      });
      result.countriesCreated++;
    }
  }

  return result;
}
