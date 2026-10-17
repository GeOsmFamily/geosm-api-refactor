import type { PrismaClient } from '@prisma/client';

/**
 * Etiquettes des publications (cahier fonctionnel 4.5.3, cahier technique 4.4.1) :
 * - les 17 Objectifs de developpement durable des Nations unies, globaux (instanceId null),
 *   avec leur couleur officielle ; jamais modifiables par l'API ;
 * - des etiquettes libres par pays ouvert (maquette 53), gerees ensuite centralement par les
 *   administrateurs (RG-E-10).
 * Libelles en JSON {fr,en,es}, localises a la lecture. Idempotent (upsert par slug).
 */
const t = (fr: string, en: string, es: string) => JSON.stringify({ fr, en, es });

export const SDG_TAGS: Array<{ number: number; color: string; label: string }> = [
  { number: 1, color: '#E5243B', label: t('Pas de pauvreté', 'No poverty', 'Fin de la pobreza') },
  { number: 2, color: '#DDA63A', label: t('Faim « zéro »', 'Zero hunger', 'Hambre cero') },
  {
    number: 3,
    color: '#4C9F38',
    label: t('Bonne santé et bien-être', 'Good health and well-being', 'Salud y bienestar'),
  },
  { number: 4, color: '#C5192D', label: t('Éducation de qualité', 'Quality education', 'Educación de calidad') },
  { number: 5, color: '#FF3A21', label: t('Égalité entre les sexes', 'Gender equality', 'Igualdad de género') },
  {
    number: 6,
    color: '#26BDE2',
    label: t('Eau propre et assainissement', 'Clean water and sanitation', 'Agua limpia y saneamiento'),
  },
  {
    number: 7,
    color: '#FCC30B',
    label: t(
      "Énergie propre et d'un coût abordable",
      'Affordable and clean energy',
      'Energía asequible y no contaminante',
    ),
  },
  {
    number: 8,
    color: '#A21942',
    label: t(
      'Travail décent et croissance économique',
      'Decent work and economic growth',
      'Trabajo decente y crecimiento económico',
    ),
  },
  {
    number: 9,
    color: '#FD6925',
    label: t(
      'Industrie, innovation et infrastructure',
      'Industry, innovation and infrastructure',
      'Industria, innovación e infraestructura',
    ),
  },
  {
    number: 10,
    color: '#DD1367',
    label: t('Inégalités réduites', 'Reduced inequalities', 'Reducción de las desigualdades'),
  },
  {
    number: 11,
    color: '#FD9D24',
    label: t(
      'Villes et communautés durables',
      'Sustainable cities and communities',
      'Ciudades y comunidades sostenibles',
    ),
  },
  {
    number: 12,
    color: '#BF8B2E',
    label: t(
      'Consommation et production responsables',
      'Responsible consumption and production',
      'Producción y consumo responsables',
    ),
  },
  {
    number: 13,
    color: '#3F7E44',
    label: t(
      'Mesures relatives à la lutte contre les changements climatiques',
      'Climate action',
      'Acción por el clima',
    ),
  },
  { number: 14, color: '#0A97D9', label: t('Vie aquatique', 'Life below water', 'Vida submarina') },
  { number: 15, color: '#56C02B', label: t('Vie terrestre', 'Life on land', 'Vida de ecosistemas terrestres') },
  {
    number: 16,
    color: '#00689D',
    label: t(
      'Paix, justice et institutions efficaces',
      'Peace, justice and strong institutions',
      'Paz, justicia e instituciones sólidas',
    ),
  },
  {
    number: 17,
    color: '#19486A',
    label: t(
      'Partenariats pour la réalisation des objectifs',
      'Partnerships for the goals',
      'Alianzas para lograr los objetivos',
    ),
  },
];

/** Etiquettes libres par defaut d'un pays (maquette 53). */
export const DEFAULT_CUSTOM_TAGS: Array<{ key: string; label: string }> = [
  { key: 'sociologie', label: t('Sociologie', 'Sociology', 'Sociología') },
  { key: 'histoire', label: t('Histoire', 'History', 'Historia') },
  { key: 'education', label: t('Éducation', 'Education', 'Educación') },
  { key: 'informatique', label: t('Informatique', 'Computing', 'Informática') },
  { key: 'travaux', label: t('Travaux', 'Works', 'Obras') },
  { key: 'travaux-routiers', label: t('Travaux routiers', 'Road works', 'Obras viales') },
  { key: 'ingenierie-civile', label: t('Ingénierie civile', 'Civil engineering', 'Ingeniería civil') },
  { key: 'construction-de-site', label: t('Construction de site', 'Site construction', 'Construcción de obra') },
];

export const sdgSlug = (n: number) => `sdg-${n}`;

export async function seedPostTags(prisma: PrismaClient): Promise<{ sdg: number; custom: number }> {
  for (const sdg of SDG_TAGS) {
    await prisma.tag.upsert({
      where: { slug: sdgSlug(sdg.number) },
      create: {
        slug: sdgSlug(sdg.number),
        label: sdg.label,
        category: 'SDG',
        sdgNumber: sdg.number,
        color: sdg.color,
      },
      update: { label: sdg.label, color: sdg.color, sdgNumber: sdg.number },
    });
  }

  // Un pays qui a deja ses etiquettes libres n'est jamais touche (elles sont gerees ensuite).
  const instances = await prisma.instance.findMany({
    where: { isActive: true, kind: { not: 'CONTINENT' } },
    select: { id: true, slug: true, _count: { select: { tags: true } } },
  });
  let custom = 0;
  for (const instance of instances) {
    if (instance._count.tags > 0) continue;
    await prisma.tag.createMany({
      data: DEFAULT_CUSTOM_TAGS.map((tag) => ({
        slug: `${instance.slug}-${tag.key}`,
        label: tag.label,
        category: 'CUSTOM' as const,
        instanceId: instance.id,
      })),
      skipDuplicates: true,
    });
    custom++;
  }
  return { sdg: SDG_TAGS.length, custom };
}
