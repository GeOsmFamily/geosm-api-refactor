import { PrismaClient } from '@prisma/client';
import {
  Osm2pgsqlService,
  type Osm2pgsqlOptions,
} from '../../../infrastructure/osm/osm2pgsql.service.js';
import type { IEmailService } from '../../services/email.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const logger = createChildLogger('ImportOsmDataUseCase');

export interface ImportOsmDataInput {
  pbfPath: string;
  slim?: boolean;
  append?: boolean;
  styleFile?: string;
  cache?: number;
}

export type ImportOsmProgressCallback = (progress: {
  percent: number;
  step: number;
  totalSteps: number;
  message: string;
}) => Promise<void> | void;

export class ImportOsmDataUseCase {
  constructor(
    private readonly osm2pgsqlService: Osm2pgsqlService,
    private readonly prisma: PrismaClient,
    private readonly dataDir: string = '/tmp/geosm-data',
    private readonly postImportScript?: string,
    private readonly emailService?: IEmailService,
    private readonly adminEmail?: string,
  ) {}

  async execute(
    input: ImportOsmDataInput,
    onProgress?: ImportOsmProgressCallback,
  ): Promise<{ success: boolean; message: string }> {
    if (!input.pbfPath) {
      throw new Error('PBF file path or URL is required');
    }

    const startTime = Date.now();
    let localPbfPath = input.pbfPath;

    // 1. Comptage des objets avant l'import
    const countsBefore = await this.getOsmCounts();

    await onProgress?.({
      percent: 10,
      step: 1,
      totalSteps: 4,
      message: "Initialisation du job d'import OSM...",
    });

    // Si le chemin est une URL (ex: https://download.geofabrik.de/africa/mali-latest.osm.pbf)
    if (input.pbfPath.startsWith('http://') || input.pbfPath.startsWith('https://')) {
      logger.info('Downloading PBF file from URL', { url: input.pbfPath });
      await onProgress?.({
        percent: 25,
        step: 1,
        totalSteps: 4,
        message: "Téléchargement du fichier .osm.pbf depuis l'URL...",
      });

      await mkdir(this.dataDir, { recursive: true });

      const urlObj = new URL(input.pbfPath);
      const fileName = path.basename(urlObj.pathname) || 'osm-data.osm.pbf';
      localPbfPath = path.join(this.dataDir, fileName);

      const response = await fetch(input.pbfPath);
      if (!response.ok) {
        throw new Error(
          `Failed to download PBF file from ${input.pbfPath}: ${response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      await writeFile(localPbfPath, Buffer.from(arrayBuffer));
      logger.info('PBF file downloaded successfully', { localPbfPath });
    }

    await onProgress?.({
      percent: 40,
      step: 2,
      totalSteps: 4,
      message: 'Importation des données spatiales dans PostGIS via osm2pgsql...',
    });

    const options: Osm2pgsqlOptions = {
      slim: input.slim ?? true,
      append: input.append ?? false,
      styleFile: input.styleFile,
      cache: input.cache ?? 800,
    };

    let result: { success: boolean; message: string };

    if (input.append) {
      logger.info('OSM data update starting', { pbfPath: localPbfPath, slim: options.slim });
      result = await this.osm2pgsqlService.updateData(localPbfPath, options);
    } else {
      logger.info('OSM data import starting', { pbfPath: localPbfPath, slim: options.slim });
      result = await this.osm2pgsqlService.importFile(localPbfPath, options);
    }

    await onProgress?.({
      percent: 75,
      step: 3,
      totalSteps: 4,
      message: 'Extraction automatique des limites administratives...',
    });

    const extractedBoundariesCount = await this.moveTablesToOsmSchema();

    await onProgress?.({
      percent: 90,
      step: 4,
      totalSteps: 4,
      message: 'Mise à jour des conteneurs Nominatim & OSRM...',
    });

    // Déclenchement facultatif du script d'action post-import (mise à jour Nominatim / OSRM)
    if (this.postImportScript) {
      try {
        logger.info('Running post-import script for Nominatim/OSRM', {
          script: this.postImportScript,
        });
        await execAsync(`${this.postImportScript} "${localPbfPath}" "${this.dataDir}"`);
        logger.info('Post-import script completed successfully');
      } catch (scriptErr) {
        logger.warn('Post-import script failed', { error: scriptErr });
      }
    }

    // 2. Comptage des objets après l'import & envoi du rapport e-mail
    const countsAfter = await this.getOsmCounts();
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    if (this.emailService && this.adminEmail) {
      try {
        await this.emailService.sendOsmImportReportEmail(this.adminEmail, {
          pbfPath: input.pbfPath,
          durationSeconds,
          extractedBoundariesCount,
          pointsBefore: countsBefore.points,
          pointsAfter: countsAfter.points,
          polygonsBefore: countsBefore.polygons,
          polygonsAfter: countsAfter.polygons,
          linesBefore: countsBefore.lines,
          linesAfter: countsAfter.lines,
        });
        logger.info('Sent OSM import report email to super admin', {
          to: this.adminEmail,
        });
      } catch (emailErr) {
        logger.warn('Failed to send OSM import report email', { error: emailErr });
      }
    }

    await onProgress?.({
      percent: 100,
      step: 4,
      totalSteps: 4,
      message: 'Importation et synchronisation terminées avec succès !',
    });

    logger.info('OSM data import completed', { pbfPath: localPbfPath, success: result.success });
    return result;
  }

  private async getOsmCounts(): Promise<{ points: number; polygons: number; lines: number }> {
    try {
      const resPoints = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) FROM osm.planet_osm_point`,
      );
      const resPolygons = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) FROM osm.planet_osm_polygon`,
      );
      const resLines = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) FROM osm.planet_osm_line`,
      );
      return {
        points: Number(resPoints[0]?.count ?? 0),
        polygons: Number(resPolygons[0]?.count ?? 0),
        lines: Number(resLines[0]?.count ?? 0),
      };
    } catch {
      return { points: 0, polygons: 0, lines: 0 };
    }
  }

  private async moveTablesToOsmSchema(): Promise<number> {
    await this.prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS osm');
    for (const t of ['point', 'line', 'polygon', 'roads', 'nodes', 'ways', 'rels']) {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE IF EXISTS public.planet_osm_${t} SET SCHEMA osm`,
      );
    }
    return this.populateAdminBoundariesFromOsmPolygons();
  }

  private async populateAdminBoundariesFromOsmPolygons(): Promise<number> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.admin_boundaries (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          admin_level INTEGER,
          geom geometry(MultiPolygon, 4326)
        );
      `);
      const inserted = await this.prisma.$executeRawUnsafe(`
        INSERT INTO public.admin_boundaries (name, admin_level, geom)
        SELECT 
          name, 
          CASE WHEN admin_level ~ '^[0-9]+$' THEN admin_level::integer ELSE NULL END,
          ST_Multi(ST_Transform(way, 4326))
        FROM osm.planet_osm_polygon
        WHERE boundary = 'administrative' 
          AND name IS NOT NULL
          AND ST_IsValid(way);
      `);
      logger.info('Extracted administrative boundaries into public.admin_boundaries', {
        count: inserted,
      });
      return Number(inserted ?? 0);
    } catch (err) {
      logger.warn('Failed to extract boundaries from OSM polygons', { error: err });
      return 0;
    }
  }
}
