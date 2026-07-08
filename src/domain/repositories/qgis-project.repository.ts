import { QgisProject } from '../entities/qgis-project.entity.js';

export interface IQgisProjectRepository {
  findByInstanceId(instanceId: string): Promise<QgisProject[]>;
  findById(id: string): Promise<QgisProject | null>;
  create(data: Omit<QgisProject, 'createdAt' | 'updatedAt'>): Promise<QgisProject>;
  update(
    id: string,
    data: Partial<Omit<QgisProject, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<QgisProject>;
}
