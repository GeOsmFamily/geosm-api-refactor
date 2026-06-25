import { PrismaClient, DefaultTheme as PrismaDefaultTheme, DefaultTag as PrismaDefaultTag } from '@prisma/client';
import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';
import { DefaultTag } from '../../../domain/entities/default-tag.entity.js';

export class PrismaDefaultThemeRepository implements IDefaultThemeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<DefaultTheme[]> {
    const records = await this.prisma.defaultTheme.findMany({
      orderBy: { order: 'asc' },
      include: { tags: true },
    });
    return records.map(r => this.toDomain(r));
  }

  async findBySlug(slug: string): Promise<DefaultTheme | null> {
    const record = await this.prisma.defaultTheme.findUnique({
      where: { slug },
      include: { tags: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findById(id: string): Promise<DefaultTheme | null> {
    const record = await this.prisma.defaultTheme.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async create(data: Omit<DefaultTheme, 'createdAt' | 'updatedAt'>): Promise<DefaultTheme> {
    const record = await this.prisma.defaultTheme.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        icon: data.icon,
        color: data.color,
        order: data.order,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: Partial<Omit<DefaultTheme, 'id' | 'createdAt' | 'updatedAt'>>): Promise<DefaultTheme> {
    const record = await this.prisma.defaultTheme.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.defaultTheme.delete({ where: { id } });
  }

  async count(): Promise<number> {
    return this.prisma.defaultTheme.count();
  }

  async findTagsByThemeId(themeId: string): Promise<DefaultTag[]> {
    const records = await this.prisma.defaultTag.findMany({
      where: { themeId },
      orderBy: { name: 'asc' },
    });
    return records.map(r => this.tagToDomain(r));
  }

  async createTag(data: Omit<DefaultTag, 'createdAt' | 'updatedAt'>): Promise<DefaultTag> {
    const record = await this.prisma.defaultTag.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        themeId: data.themeId,
      },
    });
    return this.tagToDomain(record);
  }

  private toDomain(record: PrismaDefaultTheme): DefaultTheme {
    return new DefaultTheme({
      id: record.id,
      name: record.name,
      slug: record.slug,
      icon: record.icon,
      color: record.color,
      order: record.order,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private tagToDomain(record: PrismaDefaultTag): DefaultTag {
    return new DefaultTag({
      id: record.id,
      name: record.name,
      slug: record.slug,
      themeId: record.themeId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
