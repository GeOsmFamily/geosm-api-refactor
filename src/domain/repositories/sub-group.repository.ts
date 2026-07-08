import { SubGroup } from '../entities/sub-group.entity.js';

export interface ISubGroupRepository {
  findById(id: string): Promise<SubGroup | null>;
  findBySlug(slug: string, groupId: string): Promise<SubGroup | null>;
  findByGroup(groupId: string): Promise<SubGroup[]>;
  create(data: Omit<SubGroup, 'createdAt' | 'updatedAt'>): Promise<SubGroup>;
  update(
    id: string,
    data: Partial<Omit<SubGroup, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<SubGroup>;
  delete(id: string): Promise<void>;
}
