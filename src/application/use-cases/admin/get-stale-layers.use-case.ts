import type { PrismaClient } from '@prisma/client';
import { localize } from '../../utils/localize.js';

export interface StaleLayer {
  id: string;
  name: string;
  instanceId: string;
  instanceName: string;
  updatedAt: Date;
  daysSinceUpdate: number;
}

const DEFAULT_CUTOFF_DAYS = 90;

/**
 * Rapport de fraîcheur des couches : liste les couches dont `updatedAt` n'a pas bougé depuis
 * `cutoffDays` (voir plan "Couches vivantes + rapport de fraîcheur" du 2026-08-06).
 *
 * Point de vigilance documenté dans le plan : `updatedAt` est auto-géré par Prisma (`@updatedAt`)
 * sur TOUT `prisma.layer.update()`, y compris ceux faits par ResyncLayerUseCase à la fin d'une
 * resynchronisation réussie (il écrit `metadata.lastSyncedAt` dans le même appel) - donc pour les
 * couches dérivées d'OSM par défaut (les seules que ResyncLayerUseCase sait resynchroniser),
 * `updatedAt` est un signal de fraîcheur fiable. Pour les couches sans mécanisme de
 * resynchronisation (import QGIS, upload raster, publication de donnée personnelle),
 * `updatedAt` ne reflète que la création/un edit manuel - une telle couche apparaîtra donc
 * "périmée" dès que le cutoff est dépassé, ce qui est attendu (personne ne la resynchronise
 * jamais) plutôt qu'un faux positif à corriger.
 */
export class GetStaleLayersUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cutoffDays = DEFAULT_CUTOFF_DAYS, lang = 'fr'): Promise<StaleLayer[]> {
    const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);

    const layers = await this.prisma.layer.findMany({
      where: { updatedAt: { lt: cutoff } },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        instance: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });

    const now = Date.now();
    return layers.map((l) => ({
      id: l.id,
      name: localize(l.name, lang),
      instanceId: l.instance.id,
      instanceName: localize(l.instance.name, lang),
      updatedAt: l.updatedAt,
      daysSinceUpdate: Math.floor((now - l.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
    }));
  }
}
