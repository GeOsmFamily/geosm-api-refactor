import { LayerSubGroup } from '../entities/layer-sub-group.entity.js';

export interface ILayerSubGroupRepository {
  findById(id: string): Promise<LayerSubGroup | null>;
  findBySlug(slug: string, groupId: string): Promise<LayerSubGroup | null>;
  findByLayerGroup(groupId: string): Promise<LayerSubGroup[]>;
  create(data: Omit<LayerSubGroup, 'createdAt' | 'updatedAt'>): Promise<LayerSubGroup>;
  update(
    id: string,
    data: Partial<Omit<LayerSubGroup, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<LayerSubGroup>;
  delete(id: string): Promise<void>;
}
