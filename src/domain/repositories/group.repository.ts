import { Group } from '../entities/group.entity.js';

export interface IGroupRepository {
  findById(id: string): Promise<Group | null>;
  findBySlug(slug: string, instanceId: string): Promise<Group | null>;
  findByInstance(instanceId: string): Promise<Group[]>;
  create(data: Omit<Group, 'createdAt' | 'updatedAt'>): Promise<Group>;
  update(id: string, data: Partial<Omit<Group, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Group>;
  delete(id: string): Promise<void>;
}
