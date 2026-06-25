import { Export } from '../entities/export.entity.js';

export interface IExportRepository {
  findById(id: string): Promise<Export | null>;
  findByUser(userId: string): Promise<Export[]>;
  create(data: Omit<Export, 'createdAt' | 'updatedAt'>): Promise<Export>;
  update(id: string, data: Partial<Omit<Export, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Export>;
  delete(id: string): Promise<void>;
}
