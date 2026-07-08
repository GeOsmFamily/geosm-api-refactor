import { LayerStyle } from '../entities/layer-style.entity.js';

export interface ILayerStyleRepository {
  findByLayerId(layerId: string): Promise<LayerStyle[]>;
  findById(id: string): Promise<LayerStyle | null>;
  create(data: Omit<LayerStyle, 'createdAt' | 'updatedAt'>): Promise<LayerStyle>;
  update(
    id: string,
    data: Partial<Omit<LayerStyle, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<LayerStyle>;
  delete(id: string): Promise<void>;
}
