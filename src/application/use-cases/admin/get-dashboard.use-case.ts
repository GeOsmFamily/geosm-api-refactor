import { PrismaClient } from '@prisma/client';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IExportRepository } from '../../../domain/repositories/export.repository.js';
import { IDefaultThemeRepository } from '../../../domain/repositories/default-theme.repository.js';
import type { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import type { RedisService } from '../../../infrastructure/cache/redis.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetDashboardUseCase');

export interface DashboardStats {
  instanceCount: number;
  userCount: number;
  exportCount: number;
  themeCount: number;
  layerCount: number;
  boundaryCount: number;
  spatialObjectsCount: {
    points: number;
    polygons: number;
    lines: number;
  };
  servicesHealth: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
  lastBackupInfo?: {
    key: string;
    sizeBytes: number;
    lastModified: string;
  };
}

export class GetDashboardUseCase {
  constructor(
    private readonly instanceRepository: IInstanceRepository,
    private readonly userRepository: IUserRepository,
    private readonly exportRepository: IExportRepository,
    private readonly defaultThemeRepository: IDefaultThemeRepository,
    private readonly prisma?: PrismaClient,
    private readonly storageService?: MinioStorageService,
    private readonly redisService?: RedisService,
  ) {}

  async execute(): Promise<DashboardStats> {
    const [instances, users, exportCount, themeCount] = await Promise.all([
      this.instanceRepository.findAll({ limit: 1 }),
      this.userRepository.findAll({ limit: 1 }),
      this.exportRepository.count(),
      this.defaultThemeRepository.count(),
    ]);

    let layerCount = 0;
    if (this.prisma?.layer) {
      try {
        layerCount = await this.prisma.layer.count();
      } catch {
        layerCount = 0;
      }
    }

    let boundaryCount = 0;
    let points = 0;
    let polygons = 0;
    let lines = 0;
    let databaseHealth: 'up' | 'down' = 'down';

    if (this.prisma) {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        databaseHealth = 'up';
      } catch {
        databaseHealth = 'down';
      }

      try {
        const res = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT count(*) FROM public.admin_boundaries`,
        );
        boundaryCount = Number(res[0]?.count ?? 0);
      } catch {
        boundaryCount = 0;
      }

      try {
        const resPoints = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT count(*) FROM osm.planet_osm_point`,
        );
        const resPolygons = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT count(*) FROM osm.planet_osm_polygon`,
        );
        const resLines = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT count(*) FROM osm.planet_osm_line`,
        );
        points = Number(resPoints[0]?.count ?? 0);
        polygons = Number(resPolygons[0]?.count ?? 0);
        lines = Number(resLines[0]?.count ?? 0);
      } catch {
        // Tables osm pas encore importées
      }
    }

    let redisHealth: 'up' | 'down' = 'up';
    if (this.redisService) {
      try {
        const ping = await this.redisService.getClient().ping();
        redisHealth = ping === 'PONG' ? 'up' : 'down';
      } catch {
        redisHealth = 'down';
      }
    }

    // Last backup info
    let lastBackupInfo: DashboardStats['lastBackupInfo'] = undefined;
    if (this.storageService) {
      try {
        const backups = await this.storageService.listFiles('backups/postgres/');
        if (backups.length > 0) {
          const sorted = [...backups].sort(
            (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
          );
          const latest = sorted[0];
          lastBackupInfo = {
            key: latest.key,
            sizeBytes: latest.size,
            lastModified: latest.lastModified.toISOString(),
          };
        }
      } catch {
        // Storage non configuré
      }
    }

    logger.debug('Dashboard stats retrieved', {
      instanceCount: instances.total,
      userCount: users.total,
      exportCount,
      themeCount,
      layerCount,
      boundaryCount,
    });

    return {
      instanceCount: instances.total,
      userCount: users.total,
      exportCount,
      themeCount,
      layerCount,
      boundaryCount,
      spatialObjectsCount: { points, polygons, lines },
      servicesHealth: { database: databaseHealth, redis: redisHealth },
      lastBackupInfo,
    };
  }
}
