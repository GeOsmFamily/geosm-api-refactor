import { OsmQueryService, type OsmQueryOptions } from '../../../infrastructure/database/osm-query.service.js';
import type { GeoJSONFeatureCollection } from '../../../infrastructure/database/postgis.service.js';

export class QueryOsmUseCase {
  constructor(private readonly osmQueryService: OsmQueryService) {}

  async execute(options: OsmQueryOptions): Promise<GeoJSONFeatureCollection> {
    if (!options.conditions || options.conditions.length === 0) {
      throw new Error('At least one key/value condition is required');
    }
    return this.osmQueryService.queryFeatures(options);
  }
}
