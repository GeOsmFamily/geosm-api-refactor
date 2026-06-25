import { DefaultTheme } from '../entities/default-theme.entity.js';
import { DefaultTag } from '../entities/default-tag.entity.js';

export interface IDefaultThemeRepository {
  findAll(): Promise<DefaultTheme[]>;
  findBySlug(slug: string): Promise<DefaultTheme | null>;
  findById(id: string): Promise<DefaultTheme | null>;
  create(data: Omit<DefaultTheme, 'createdAt' | 'updatedAt'>): Promise<DefaultTheme>;
  update(id: string, data: Partial<Omit<DefaultTheme, 'id' | 'createdAt' | 'updatedAt'>>): Promise<DefaultTheme>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
  findTagsByThemeId(themeId: string): Promise<DefaultTag[]>;
  createTag(data: Omit<DefaultTag, 'createdAt' | 'updatedAt'>): Promise<DefaultTag>;
}
