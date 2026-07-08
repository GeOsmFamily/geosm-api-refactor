import { Export } from '../entities/export.entity.js';
import { JobStatus } from '../enums.js';

export interface IExportRepository {
  findById(id: string): Promise<Export | null>;
  findByUser(
    userId: string,
    options?: { page?: number; limit?: number; status?: JobStatus },
  ): Promise<{ data: Export[]; total: number }>;
  create(data: Omit<Export, 'createdAt' | 'updatedAt'>): Promise<Export>;
  update(
    id: string,
    data: Partial<Omit<Export, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Export>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}
