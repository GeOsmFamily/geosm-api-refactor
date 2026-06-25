import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { Export } from '../../../domain/entities/export.entity.js';
import { JobStatus } from '../../../domain/enums.js';

export class ListExportsUseCase {
  constructor(
    private readonly exportRepository: IExportRepository,
  ) {}

  async execute(userId: string, options?: { page?: number; limit?: number; status?: JobStatus }): Promise<{ data: Export[]; total: number }> {
    return this.exportRepository.findByUser(userId, options);
  }
}
