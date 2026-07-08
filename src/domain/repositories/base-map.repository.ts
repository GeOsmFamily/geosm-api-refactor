import { BaseMap } from '../entities/base-map.entity.js';

export interface IBaseMapRepository {
  findById(id: string): Promise<BaseMap | null>;
  findByInstance(instanceId: string): Promise<BaseMap[]>;
  findDefaults(): Promise<BaseMap[]>;
  create(data: Omit<BaseMap, 'createdAt' | 'updatedAt'>): Promise<BaseMap>;
  update(
    id: string,
    data: Partial<Omit<BaseMap, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BaseMap>;
  delete(id: string): Promise<void>;
}
