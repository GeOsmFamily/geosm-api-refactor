import { v4 as uuidv4 } from 'uuid';
import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import { DefaultTheme } from '../../../domain/entities/default-theme.entity.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';

const DEFAULT_THEMES = [
  { name: 'Environment', slug: 'environment', icon: 'leaf', color: '#4CAF50', order: 1 },
  { name: 'Transport', slug: 'transport', icon: 'car', color: '#2196F3', order: 2 },
  { name: 'Health', slug: 'health', icon: 'heart', color: '#F44336', order: 3 },
  { name: 'Education', slug: 'education', icon: 'book', color: '#FF9800', order: 4 },
  { name: 'Agriculture', slug: 'agriculture', icon: 'seedling', color: '#8BC34A', order: 5 },
];

export class SeedDefaultThemesUseCase {
  constructor(private readonly defaultThemeRepository: IDefaultThemeRepository) {}

  async execute(): Promise<DefaultTheme[]> {
    const created: DefaultTheme[] = [];

    for (const themeData of DEFAULT_THEMES) {
      const slug = Slug.create(themeData.slug);
      const existing = await this.defaultThemeRepository.findBySlug(slug.value);
      if (existing) {
        created.push(existing);
        continue;
      }

      const theme = await this.defaultThemeRepository.create({
        id: uuidv4(),
        name: themeData.name,
        slug: slug.value,
        icon: themeData.icon,
        color: themeData.color,
        order: themeData.order,
      });
      created.push(theme);
    }

    return created;
  }
}
