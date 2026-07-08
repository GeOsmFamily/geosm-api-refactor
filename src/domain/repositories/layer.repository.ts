import { Layer } from '../entities/layer.entity.js';
import { GeometryType } from '../enums.js';

export interface ILayerRepository {
  findById(id: string): Promise<Layer | null>;
  findBySlug(slug: string, instanceId: string): Promise<Layer | null>;
  findBySubGroup(subGroupId: string): Promise<Layer[]>;
  findByInstance(
    instanceId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      geometryType?: GeometryType;
      subGroupId?: string;
    },
  ): Promise<{ data: Layer[]; total: number }>;
  create(data: Omit<Layer, 'createdAt' | 'updatedAt'>): Promise<Layer>;
  update(id: string, data: Partial<Omit<Layer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Layer>;
  delete(id: string): Promise<void>;
}
