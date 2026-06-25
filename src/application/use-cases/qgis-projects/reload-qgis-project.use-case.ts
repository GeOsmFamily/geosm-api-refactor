import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QgisProject } from '../../../domain/entities/qgis-project.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class ReloadQgisProjectUseCase {
  constructor(
    private readonly qgisProjectRepository: IQgisProjectRepository,
  ) {}

  async execute(instanceId: string): Promise<QgisProject[]> {
    const projects = await this.qgisProjectRepository.findByInstanceId(instanceId);
    if (projects.length === 0) throw new NotFoundError('QgisProject', instanceId);

    const updated: QgisProject[] = [];
    for (const project of projects) {
      const result = await this.qgisProjectRepository.update(project.id, {});
      updated.push(result);
    }
    return updated;
  }
}
