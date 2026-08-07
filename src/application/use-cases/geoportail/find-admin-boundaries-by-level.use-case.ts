import { PrismaClient } from '@prisma/client';
import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('FindAdminBoundariesByLevelUseCase');

export interface AdminBoundaryZone {
  id: number;
  name: string;
  geojson: unknown;
}

/**
 * Trouve toutes les limites administratives (public.admin_boundaries) d'un niveau donné qui
 * intersectent la zone d'une instance - sert de source de "zones" pour les statistiques
 * zonales raster (voir plan Analyse raster), en réutilisant Instance.boundaryTable/boundaryId
 * (même résolution que GetBoundaryUseCase) avec repli sur Instance.bbox si aucune limite précise
 * n'est configurée.
 */
export class FindAdminBoundariesByLevelUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly instanceRepository: IInstanceRepository,
  ) {}

  async execute(instanceId: string, adminLevel?: number): Promise<AdminBoundaryZone[]> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);

    const level = adminLevel ?? instance.adminLevel;
    if (level == null) {
      throw new ValidationError(
        "Aucun niveau administratif configuré pour cette instance (Instance.adminLevel) et aucun n'a été fourni",
        {},
      );
    }

    const instanceGeomSql = this.resolveInstanceGeomSql(instance);
    if (!instanceGeomSql) {
      throw new ValidationError(
        "Cette instance n'a ni limite administrative (boundaryTable/boundaryId) ni bbox configurée",
        {},
      );
    }

    const rows = await this.prisma.$queryRawUnsafe<AdminBoundaryZone[]>(
      `SELECT id, name, ST_AsGeoJSON(geom)::json AS geojson
       FROM public.admin_boundaries
       WHERE admin_level = $1
         AND ST_Intersects(geom, (${instanceGeomSql}))`,
      level,
    );
    logger.debug('Found admin boundaries by level', { instanceId, level, count: rows.length });
    return rows;
  }

  /**
   * Liste les niveaux administratifs réellement disponibles pour une instance (indépendamment
   * de Instance.adminLevel, qui peut être vide - ex. l'instance racine "Cameroun", qui n'a ni
   * adminLevel ni boundaryTable/boundaryId configurés mais dispose d'un bbox) - sert à peupler
   * un sélecteur de niveau côté statistiques raster "par zone" plutôt que d'échouer silencieusement
   * quand aucun défaut n'est disponible (voir plan "refonte Statistiques" du 2026-08-05).
   */
  async findAvailableLevels(instanceId: string): Promise<number[]> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);

    const instanceGeomSql = this.resolveInstanceGeomSql(instance);
    if (!instanceGeomSql) {
      throw new ValidationError(
        "Cette instance n'a ni limite administrative (boundaryTable/boundaryId) ni bbox configurée",
        {},
      );
    }

    const rows = await this.prisma.$queryRawUnsafe<{ admin_level: number }[]>(
      `SELECT DISTINCT admin_level
       FROM public.admin_boundaries
       WHERE ST_Intersects(geom, (${instanceGeomSql}))
       ORDER BY admin_level`,
    );
    return rows.map((r) => r.admin_level);
  }

  /**
   * Construit la sous-requête SQL renvoyant la géométrie de l'instance - même logique de
   * résolution que GetBoundaryUseCase/le frontend (map-view.component.ts loadFallbackBoundary),
   * boundaryTable/boundaryId préféré, repli sur bbox. Les identifiants viennent de la DB
   * (Instance.boundaryTable/boundaryGeomCol déjà validés à la création de l'instance), pas d'une
   * entrée utilisateur libre à cet endroit - sanitization minimale par cohérence.
   */
  private resolveInstanceGeomSql(instance: {
    boundaryTable: string | null;
    boundaryId: number | null;
    boundaryGeomCol: string | null;
    bbox: number[] | null;
  }): string | null {
    const sanitize = (v: string) => v.replace(/[^a-zA-Z0-9_]/g, '');

    if (instance.boundaryTable && instance.boundaryId != null) {
      const parts = instance.boundaryTable.split('.');
      const schema = sanitize(parts.length > 1 ? parts[0] : 'public');
      const table = sanitize(parts.length > 1 ? parts[1] : parts[0]);
      const geomCol = sanitize(instance.boundaryGeomCol || 'geom');
      return `SELECT "${geomCol}" FROM "${schema}"."${table}" WHERE id = ${Number(instance.boundaryId)}`;
    }
    if (instance.bbox && instance.bbox.length === 4) {
      const [minLon, minLat, maxLon, maxLat] = instance.bbox;
      return `SELECT ST_SetSRID(ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}), 4326)`;
    }
    return null;
  }
}
