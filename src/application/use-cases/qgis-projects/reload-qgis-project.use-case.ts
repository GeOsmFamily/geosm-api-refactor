import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QgisProject } from '../../../domain/entities/qgis-project.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ReloadQgisProjectUseCase');

export class ReloadQgisProjectUseCase {
  constructor(
    private readonly qgisProjectRepository: IQgisProjectRepository,
  ) {}

  async execute(instanceId: string): Promise<QgisProject[]> {
    const projects = await this.qgisProjectRepository.findByInstanceId(instanceId);
    if (projects.length === 0) {
      logger.warn('Reload QGIS project rejected: no projects found', { instanceId });
      throw new NotFoundError('QgisProject', instanceId);
    }

    const updated: QgisProject[] = [];
    for (const project of projects) {
      const result = await this.qgisProjectRepository.update(project.id, {});
      updated.push(result);
    }
    logger.info('QGIS projects reloaded', { instanceId, count: updated.length });
    return updated;
  }
}
