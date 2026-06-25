import { PrismaClient } from '@prisma/client';

export interface SeoMetadata {
  title: string;
  description: string;
  ogImage: string | null;
  ogUrl: string;
  siteName: string;
  keywords: string[];
}

export class GetSeoMetadataUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(instanceSlug: string, baseUrl: string): Promise<SeoMetadata | null> {
    const instance = await this.prisma.instance.findUnique({
      where: { slug: instanceSlug },
      include: {
        groups: {
          select: { name: true },
          take: 10,
        },
      },
    });

    if (!instance) return null;

    const keywords = instance.groups.map((g) => g.name);

    return {
      title: `${instance.name} - GeoSM`,
      description: instance.description ?? `Explore ${instance.name} geospatial data on GeoSM`,
      ogImage: instance.logo,
      ogUrl: `${baseUrl}/${instance.slug}`,
      siteName: 'GeoSM',
      keywords,
    };
  }
}
