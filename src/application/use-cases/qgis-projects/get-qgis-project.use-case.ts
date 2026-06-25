import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QgisProject } from '../../../domain/entities/qgis-project.entity.js';

export class GetQgisProjectUseCase {
  constructor(
    private readonly qgisProjectRepository: IQgisProjectRepository,
  ) {}

  async execute(instanceId: string): Promise<QgisProject[]> {
    return this.qgisProjectRepository.findByInstanceId(instanceId);
  }
}
