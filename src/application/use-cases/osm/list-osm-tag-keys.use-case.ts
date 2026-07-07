import { OsmQueryService } from '../../../infrastructure/database/osm-query.service.js';

export class ListOsmTagKeysUseCase {
  constructor(private readonly osmQueryService: OsmQueryService) {}

  async execute(geometryType: 'point' | 'line' | 'polygon'): Promise<string[]> {
    return this.osmQueryService.listTagKeys(geometryType);
  }
}
