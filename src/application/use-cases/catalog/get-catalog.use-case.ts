import { PrismaClient } from '@prisma/client';

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

  async execute(instanceSlug?: string): Promise<CatalogInstance[]> {
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
      name: inst.name,
      slug: inst.slug,
      description: inst.description,
      logo: inst.logo,
      groups: inst.groups.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        description: g.description,
        icon: g.icon,
        color: g.color,
        subGroups: g.subGroups.map((sg) => ({
          id: sg.id,
          name: sg.name,
          slug: sg.slug,
          description: sg.description,
          layers: sg.layers,
        })),
      })),
    }));
  }
}
