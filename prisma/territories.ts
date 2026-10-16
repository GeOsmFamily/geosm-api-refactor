import type { PrismaClient } from '@prisma/client';

/**
 * Donnees territoriales de GeOsm Family : 6 continents et une liste de pays.
 *
 * Tous les pays du monde (decision du 16 oct 2026) : les 193 Etats membres de l'ONU, plus la
 * Palestine et le Vatican (observateurs). Tous « non disponibles » tant qu'ils n'ont pas
 * d'instance ouverte (aujourd'hui seul le Cameroun). Ajouter un pays = ajouter une ligne ici et
 * relancer le seed.
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

  { iso: 'al', name: 'Albanie', continent: 'europe' },
  { iso: 'ad', name: 'Andorre', continent: 'europe' },
  { iso: 'at', name: 'Autriche', continent: 'europe' },
  { iso: 'by', name: 'Biélorussie', continent: 'europe' },
  { iso: 'be', name: 'Belgique', continent: 'europe' },
  { iso: 'ba', name: 'Bosnie-Herzégovine', continent: 'europe' },
  { iso: 'bg', name: 'Bulgarie', continent: 'europe' },
  { iso: 'hr', name: 'Croatie', continent: 'europe' },
  { iso: 'cy', name: 'Chypre', continent: 'europe' },
  { iso: 'cz', name: 'Tchéquie', continent: 'europe' },
  { iso: 'dk', name: 'Danemark', continent: 'europe' },
  { iso: 'ee', name: 'Estonie', continent: 'europe' },
  { iso: 'fi', name: 'Finlande', continent: 'europe' },
  { iso: 'fr', name: 'France', continent: 'europe' },
  { iso: 'de', name: 'Allemagne', continent: 'europe' },
  { iso: 'gr', name: 'Grèce', continent: 'europe' },
  { iso: 'hu', name: 'Hongrie', continent: 'europe' },
  { iso: 'is', name: 'Islande', continent: 'europe' },
  { iso: 'ie', name: 'Irlande', continent: 'europe' },
  { iso: 'it', name: 'Italie', continent: 'europe' },
  { iso: 'lv', name: 'Lettonie', continent: 'europe' },
  { iso: 'li', name: 'Liechtenstein', continent: 'europe' },
  { iso: 'lt', name: 'Lituanie', continent: 'europe' },
  { iso: 'lu', name: 'Luxembourg', continent: 'europe' },
  { iso: 'mt', name: 'Malte', continent: 'europe' },
  { iso: 'md', name: 'Moldavie', continent: 'europe' },
  { iso: 'mc', name: 'Monaco', continent: 'europe' },
  { iso: 'me', name: 'Monténégro', continent: 'europe' },
  { iso: 'nl', name: 'Pays-Bas', continent: 'europe' },
  { iso: 'mk', name: 'Macédoine du Nord', continent: 'europe' },
  { iso: 'no', name: 'Norvège', continent: 'europe' },
  { iso: 'pl', name: 'Pologne', continent: 'europe' },
  { iso: 'pt', name: 'Portugal', continent: 'europe' },
  { iso: 'ro', name: 'Roumanie', continent: 'europe' },
  { iso: 'ru', name: 'Russie', continent: 'europe' },
  { iso: 'sm', name: 'Saint-Marin', continent: 'europe' },
  { iso: 'rs', name: 'Serbie', continent: 'europe' },
  { iso: 'sk', name: 'Slovaquie', continent: 'europe' },
  { iso: 'si', name: 'Slovénie', continent: 'europe' },
  { iso: 'es', name: 'Espagne', continent: 'europe' },
  { iso: 'se', name: 'Suède', continent: 'europe' },
  { iso: 'ch', name: 'Suisse', continent: 'europe' },
  { iso: 'ua', name: 'Ukraine', continent: 'europe' },
  { iso: 'gb', name: 'Royaume-Uni', continent: 'europe' },
  { iso: 'va', name: 'Vatican', continent: 'europe' },

  { iso: 'ag', name: 'Antigua-et-Barbuda', continent: 'amerique-du-nord' },
  { iso: 'bs', name: 'Bahamas', continent: 'amerique-du-nord' },
  { iso: 'bb', name: 'Barbade', continent: 'amerique-du-nord' },
  { iso: 'bz', name: 'Belize', continent: 'amerique-du-nord' },
  { iso: 'ca', name: 'Canada', continent: 'amerique-du-nord' },
  { iso: 'cr', name: 'Costa Rica', continent: 'amerique-du-nord' },
  { iso: 'cu', name: 'Cuba', continent: 'amerique-du-nord' },
  { iso: 'dm', name: 'Dominique', continent: 'amerique-du-nord' },
  { iso: 'do', name: 'République dominicaine', continent: 'amerique-du-nord' },
  { iso: 'sv', name: 'Salvador', continent: 'amerique-du-nord' },
  { iso: 'gd', name: 'Grenade', continent: 'amerique-du-nord' },
  { iso: 'gt', name: 'Guatemala', continent: 'amerique-du-nord' },
  { iso: 'ht', name: 'Haïti', continent: 'amerique-du-nord' },
  { iso: 'hn', name: 'Honduras', continent: 'amerique-du-nord' },
  { iso: 'jm', name: 'Jamaïque', continent: 'amerique-du-nord' },
  { iso: 'mx', name: 'Mexique', continent: 'amerique-du-nord' },
  { iso: 'ni', name: 'Nicaragua', continent: 'amerique-du-nord' },
  { iso: 'pa', name: 'Panama', continent: 'amerique-du-nord' },
  { iso: 'kn', name: 'Saint-Christophe-et-Niévès', continent: 'amerique-du-nord' },
  { iso: 'lc', name: 'Sainte-Lucie', continent: 'amerique-du-nord' },
  { iso: 'vc', name: 'Saint-Vincent-et-les-Grenadines', continent: 'amerique-du-nord' },
  { iso: 'tt', name: 'Trinité-et-Tobago', continent: 'amerique-du-nord' },
  { iso: 'us', name: 'États-Unis', continent: 'amerique-du-nord' },

  { iso: 'ar', name: 'Argentine', continent: 'amerique-du-sud' },
  { iso: 'bo', name: 'Bolivie', continent: 'amerique-du-sud' },
  { iso: 'br', name: 'Brésil', continent: 'amerique-du-sud' },
  { iso: 'cl', name: 'Chili', continent: 'amerique-du-sud' },
  { iso: 'co', name: 'Colombie', continent: 'amerique-du-sud' },
  { iso: 'ec', name: 'Équateur', continent: 'amerique-du-sud' },
  { iso: 'gy', name: 'Guyana', continent: 'amerique-du-sud' },
  { iso: 'py', name: 'Paraguay', continent: 'amerique-du-sud' },
  { iso: 'pe', name: 'Pérou', continent: 'amerique-du-sud' },
  { iso: 'sr', name: 'Suriname', continent: 'amerique-du-sud' },
  { iso: 'uy', name: 'Uruguay', continent: 'amerique-du-sud' },
  { iso: 've', name: 'Venezuela', continent: 'amerique-du-sud' },

  { iso: 'af', name: 'Afghanistan', continent: 'asie' },
  { iso: 'am', name: 'Arménie', continent: 'asie' },
  { iso: 'az', name: 'Azerbaïdjan', continent: 'asie' },
  { iso: 'bh', name: 'Bahreïn', continent: 'asie' },
  { iso: 'bd', name: 'Bangladesh', continent: 'asie' },
  { iso: 'bt', name: 'Bhoutan', continent: 'asie' },
  { iso: 'bn', name: 'Brunei', continent: 'asie' },
  { iso: 'kh', name: 'Cambodge', continent: 'asie' },
  { iso: 'cn', name: 'Chine', continent: 'asie' },
  { iso: 'ge', name: 'Géorgie', continent: 'asie' },
  { iso: 'in', name: 'Inde', continent: 'asie' },
  { iso: 'id', name: 'Indonésie', continent: 'asie' },
  { iso: 'ir', name: 'Iran', continent: 'asie' },
  { iso: 'iq', name: 'Irak', continent: 'asie' },
  { iso: 'il', name: 'Israël', continent: 'asie' },
  { iso: 'jp', name: 'Japon', continent: 'asie' },
  { iso: 'jo', name: 'Jordanie', continent: 'asie' },
  { iso: 'kz', name: 'Kazakhstan', continent: 'asie' },
  { iso: 'kw', name: 'Koweït', continent: 'asie' },
  { iso: 'kg', name: 'Kirghizistan', continent: 'asie' },
  { iso: 'la', name: 'Laos', continent: 'asie' },
  { iso: 'lb', name: 'Liban', continent: 'asie' },
  { iso: 'my', name: 'Malaisie', continent: 'asie' },
  { iso: 'mv', name: 'Maldives', continent: 'asie' },
  { iso: 'mn', name: 'Mongolie', continent: 'asie' },
  { iso: 'mm', name: 'Birmanie', continent: 'asie' },
  { iso: 'np', name: 'Népal', continent: 'asie' },
  { iso: 'kp', name: 'Corée du Nord', continent: 'asie' },
  { iso: 'om', name: 'Oman', continent: 'asie' },
  { iso: 'pk', name: 'Pakistan', continent: 'asie' },
  { iso: 'ps', name: 'Palestine', continent: 'asie' },
  { iso: 'ph', name: 'Philippines', continent: 'asie' },
  { iso: 'qa', name: 'Qatar', continent: 'asie' },
  { iso: 'sa', name: 'Arabie saoudite', continent: 'asie' },
  { iso: 'sg', name: 'Singapour', continent: 'asie' },
  { iso: 'kr', name: 'Corée du Sud', continent: 'asie' },
  { iso: 'lk', name: 'Sri Lanka', continent: 'asie' },
  { iso: 'sy', name: 'Syrie', continent: 'asie' },
  { iso: 'tj', name: 'Tadjikistan', continent: 'asie' },
  { iso: 'th', name: 'Thaïlande', continent: 'asie' },
  { iso: 'tl', name: 'Timor oriental', continent: 'asie' },
  { iso: 'tr', name: 'Turquie', continent: 'asie' },
  { iso: 'tm', name: 'Turkménistan', continent: 'asie' },
  { iso: 'ae', name: 'Émirats arabes unis', continent: 'asie' },
  { iso: 'uz', name: 'Ouzbékistan', continent: 'asie' },
  { iso: 'vn', name: 'Viêt Nam', continent: 'asie' },
  { iso: 'ye', name: 'Yémen', continent: 'asie' },

  { iso: 'au', name: 'Australie', continent: 'oceanie' },
  { iso: 'fj', name: 'Fidji', continent: 'oceanie' },
  { iso: 'ki', name: 'Kiribati', continent: 'oceanie' },
  { iso: 'mh', name: 'Îles Marshall', continent: 'oceanie' },
  { iso: 'fm', name: 'Micronésie', continent: 'oceanie' },
  { iso: 'nr', name: 'Nauru', continent: 'oceanie' },
  { iso: 'nz', name: 'Nouvelle-Zélande', continent: 'oceanie' },
  { iso: 'pw', name: 'Palaos', continent: 'oceanie' },
  { iso: 'pg', name: 'Papouasie-Nouvelle-Guinée', continent: 'oceanie' },
  { iso: 'ws', name: 'Samoa', continent: 'oceanie' },
  { iso: 'sb', name: 'Îles Salomon', continent: 'oceanie' },
  { iso: 'to', name: 'Tonga', continent: 'oceanie' },
  { iso: 'tv', name: 'Tuvalu', continent: 'oceanie' },
  { iso: 'vu', name: 'Vanuatu', continent: 'oceanie' },
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
