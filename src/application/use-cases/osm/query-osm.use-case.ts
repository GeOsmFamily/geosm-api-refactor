import { OsmQueryService, type OsmQueryOptions } from '../../../infrastructure/database/osm-query.service.js';
import type { GeoJSONFeatureCollection } from '../../../infrastructure/database/postgis.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('QueryOsmUseCase');

export class QueryOsmUseCase {
  constructor(private readonly osmQueryService: OsmQueryService) {}

  async execute(options: OsmQueryOptions): Promise<GeoJSONFeatureCollection> {
    if (!options.conditions || options.conditions.length === 0) {
      throw new Error('At least one key/value condition is required');
    }
    logger.debug('Querying OSM features', { tables: options.tables, conditionCount: options.conditions.length });
    return this.osmQueryService.queryFeatures(options);
  }
}
