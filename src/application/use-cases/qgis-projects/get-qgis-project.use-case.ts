import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QgisProject } from '../../../domain/entities/qgis-project.entity.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetQgisProjectUseCase');

export class GetQgisProjectUseCase {
  constructor(
    private readonly qgisProjectRepository: IQgisProjectRepository,
  ) {}

  async execute(instanceId: string): Promise<QgisProject[]> {
    logger.debug('Fetching QGIS projects', { instanceId });
    return this.qgisProjectRepository.findByInstanceId(instanceId);
  }
}
