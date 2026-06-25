import { OsmQueryService, type CreateOsmTableOptions, type OsmTableStats } from '../../../infrastructure/database/osm-query.service.js';

export class CreateOsmTableUseCase {
  constructor(private readonly osmQueryService: OsmQueryService) {}

  async execute(options: CreateOsmTableOptions): Promise<OsmTableStats> {
    if (!options.schema || !options.table) {
      throw new Error('Schema and table name are required');
    }
    if (!options.conditions || options.conditions.length === 0) {
      throw new Error('At least one key/value condition is required');
    }
    return this.osmQueryService.createTable(options);
  }
}
