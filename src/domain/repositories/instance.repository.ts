import { Instance } from '../entities/instance.entity.js';

export interface IInstanceRepository {
  findById(id: string): Promise<Instance | null>;
  findBySlug(slug: string): Promise<Instance | null>;
  findAll(): Promise<Instance[]>;
  create(data: Omit<Instance, 'createdAt' | 'updatedAt'>): Promise<Instance>;
  update(id: string, data: Partial<Omit<Instance, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Instance>;
  delete(id: string): Promise<void>;
}
