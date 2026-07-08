import { PrismaClient } from '@prisma/client';
import {
  Osm2pgsqlService,
  type Osm2pgsqlOptions,
} from '../../../infrastructure/osm/osm2pgsql.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ImportOsmDataUseCase');

export interface ImportOsmDataInput {
  pbfPath: string;
  slim?: boolean;
  append?: boolean;
  styleFile?: string;
  cache?: number;
}

export class ImportOsmDataUseCase {
  constructor(
    private readonly osm2pgsqlService: Osm2pgsqlService,
    private readonly prisma: PrismaClient,
  ) {}

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
      logger.info('OSM data update starting', { pbfPath: input.pbfPath, slim: options.slim });
      const result = await this.osm2pgsqlService.updateData(input.pbfPath, options);
      await this.moveTablesToOsmSchema();
      logger.info('OSM data update completed', { pbfPath: input.pbfPath, success: result.success });
      return result;
    }

    logger.info('OSM data import starting', { pbfPath: input.pbfPath, slim: options.slim });
    const result = await this.osm2pgsqlService.importFile(input.pbfPath, options);
    await this.moveTablesToOsmSchema();
    logger.info('OSM data import completed', { pbfPath: input.pbfPath, success: result.success });
    return result;
  }

  private async moveTablesToOsmSchema(): Promise<void> {
    await this.prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS osm');
    for (const t of ['point', 'line', 'polygon', 'roads', 'nodes', 'ways', 'rels']) {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE IF EXISTS public.planet_osm_${t} SET SCHEMA osm`,
      );
    }
  }
}
