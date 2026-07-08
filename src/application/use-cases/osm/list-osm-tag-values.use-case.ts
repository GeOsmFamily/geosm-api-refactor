import { OsmQueryService } from '../../../infrastructure/database/osm-query.service.js';

export class ListOsmTagValuesUseCase {
  constructor(private readonly osmQueryService: OsmQueryService) {}

  async execute(geometryType: 'point' | 'line' | 'polygon', key: string): Promise<string[]> {
    return this.osmQueryService.listTagValues(geometryType, key);
  }
}
