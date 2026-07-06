import { OsmQueryService, type CreateOsmTableOptions, type OsmTableStats } from '../../../infrastructure/database/osm-query.service.js';
import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateOsmTableUseCase');

export class CreateOsmTableUseCase {
  constructor(
    private readonly osmQueryService: OsmQueryService,
    private readonly instanceRepository?: IInstanceRepository,
  ) {}

  async execute(options: CreateOsmTableOptions & { instanceId?: string }): Promise<OsmTableStats> {
    if (!options.schema || !options.table) {
      throw new Error('Schema and table name are required');
    }
    if (!options.conditions || options.conditions.length === 0) {
      throw new Error('At least one key/value condition is required');
    }

    if (options.instanceId && this.instanceRepository && !options.boundaryTable) {
      const instance = await this.instanceRepository.findById(options.instanceId);
      if (instance?.boundaryTable && instance.boundaryId != null) {
        options.boundaryTable = instance.boundaryTable;
        options.boundaryId = instance.boundaryId;
        options.boundaryGeomColumn = instance.boundaryGeomCol ?? 'geom';
      } else if (instance?.bbox && instance.bbox.length === 4) {
        options.bbox = instance.bbox as [number, number, number, number];
      }
    }

    const stats = await this.osmQueryService.createTable(options);
    logger.info('OSM table created', { schema: options.schema, table: options.table, instanceId: options.instanceId, rowCount: stats.count });
    return stats;
  }
}
