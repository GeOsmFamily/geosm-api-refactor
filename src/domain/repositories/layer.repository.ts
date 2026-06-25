import { Layer } from '../entities/layer.entity.js';

export interface ILayerRepository {
  findById(id: string): Promise<Layer | null>;
  findBySlug(slug: string, instanceId: string): Promise<Layer | null>;
  findBySubGroup(subGroupId: string): Promise<Layer[]>;
  findByInstance(instanceId: string): Promise<Layer[]>;
  create(data: Omit<Layer, 'createdAt' | 'updatedAt'>): Promise<Layer>;
  update(id: string, data: Partial<Omit<Layer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Layer>;
  delete(id: string): Promise<void>;
}
