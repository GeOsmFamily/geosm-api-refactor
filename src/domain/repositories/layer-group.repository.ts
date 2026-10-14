import { LayerGroup } from '../entities/layer-group.entity.js';

export interface ILayerGroupRepository {
  findById(id: string): Promise<LayerGroup | null>;
  findBySlug(slug: string, instanceId: string): Promise<LayerGroup | null>;
  findByInstance(instanceId: string, includeSubGroups?: boolean): Promise<LayerGroup[]>;
  create(data: Omit<LayerGroup, 'createdAt' | 'updatedAt'>): Promise<LayerGroup>;
  update(id: string, data: Partial<Omit<LayerGroup, 'id' | 'createdAt' | 'updatedAt'>>): Promise<LayerGroup>;
  delete(id: string): Promise<void>;
  updateOrder(id: string, order: number): Promise<void>;
}
