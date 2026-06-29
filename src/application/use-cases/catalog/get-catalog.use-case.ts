import { PrismaClient } from '@prisma/client';
import { localize } from '../../utils/localize.js';

export interface CatalogLayer {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  geometryType: string;
  sourceType: string;
}

export interface CatalogSubGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  layers: CatalogLayer[];
}

export interface CatalogGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  subGroups: CatalogSubGroup[];
}

export interface CatalogInstance {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  groups: CatalogGroup[];
}

export class GetCatalogUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(instanceSlug?: string, lang: string = 'fr'): Promise<CatalogInstance[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (instanceSlug) {
      where.slug = instanceSlug;
    }

    const instances = await this.prisma.instance.findMany({
      where,
      include: {
        groups: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            subGroups: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
              include: {
                layers: {
                  where: { isVisible: true },
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    geometryType: true,
                    sourceType: true,
                    sourceUrl: true,
                    tableName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return instances.map((inst) => ({
      id: inst.id,
      name: localize(inst.name, lang),
      slug: inst.slug,
      description: localize(inst.description, lang),
      logo: inst.logo,
      groups: inst.groups.map((g) => ({
        id: g.id,
        name: localize(g.name, lang),
        slug: g.slug,
        description: localize(g.description, lang),
        icon: g.icon,
        color: g.color,
        subGroups: g.subGroups.map((sg) => ({
          id: sg.id,
          name: localize(sg.name, lang),
          slug: sg.slug,
          description: localize(sg.description, lang),
          layers: sg.layers.map((l) => ({
            id: l.id,
            name: localize(l.name, lang),
            slug: l.slug,
            description: localize(l.description, lang),
            geometryType: l.geometryType,
            sourceType: l.sourceType,
            url: l.sourceUrl,
            tableName: l.tableName,
          })),
        })),
      })),
    }));
  }
}

