import { PrismaClient } from '@prisma/client';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';
import { DefaultTag } from '../../../domain/entities/default-tag.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListDefaultStylesUseCase');

export interface DefaultThemeWithTags extends DefaultTheme {
  tags: DefaultTag[];
}

export class ListDefaultStylesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(): Promise<DefaultThemeWithTags[]> {
    logger.debug('Listing default styles');
    const themes = await this.prisma.defaultTheme.findMany({
      include: { tags: true },
      orderBy: { order: 'asc' },
    });

    return themes.map((t) => ({
      ...new DefaultTheme({
        id: t.id,
        name: t.name,
        slug: t.slug,
        icon: t.icon,
        color: t.color,
        order: t.order,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }),
      tags: t.tags.map(
        (tag) =>
          new DefaultTag({
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            themeId: tag.themeId,
            createdAt: tag.createdAt,
            updatedAt: tag.updatedAt,
          }),
      ),
    }));
  }
}
