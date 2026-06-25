import { Osm2pgsqlService, type Osm2pgsqlOptions } from '../../../infrastructure/osm/osm2pgsql.service.js';

export interface ImportOsmDataInput {
  pbfPath: string;
  slim?: boolean;
  append?: boolean;
  styleFile?: string;
  cache?: number;
}

export class ImportOsmDataUseCase {
  constructor(private readonly osm2pgsqlService: Osm2pgsqlService) {}

  async execute(input: ImportOsmDataInput): Promise<{ success: boolean; message: string }> {
    if (!input.pbfPath) {
      throw new Error('PBF file path is required');
    }

    const options: Osm2pgsqlOptions = {
      slim: input.slim ?? true,
      append: input.append ?? false,
      styleFile: input.styleFile,
      cache: input.cache ?? 800,
    };

    if (input.append) {
      const result = await this.osm2pgsqlService.updateData(input.pbfPath, options);
      return result;
    }

    const result = await this.osm2pgsqlService.importFile(input.pbfPath, options);
    return result;
  }
}
