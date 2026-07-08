import { PrismaClient } from '@prisma/client';
import { dbQueryDurationSeconds, dbQueryTotal } from '../observability/metrics.js';

/**
 * Instrumente TOUTES les requêtes Prisma (tous modèles/opérations) en un seul point de
 * câblage, plutôt que d'ajouter des appels de métriques dans chacun des ~150 fichiers de
 * use-cases - dbQueryDurationSeconds/dbQueryTotal étaient définies dans metrics.ts mais
 * jamais incrémentées. Remplace l'ancienne API `$use` (middleware), retirée dans Prisma 6, par
 * les Client Extensions (`$extends`), l'équivalent actuel. Le label `operation` combine modèle
 * et action (ex. "User.findUnique") - cardinalité bornée par le nombre de modèles du schéma.
 */
export function withMetrics(prisma: PrismaClient): PrismaClient {
  const extended = prisma.$extends({
    name: 'metrics',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const label = `${model ?? 'raw'}.${operation}`;
          const end = dbQueryDurationSeconds.startTimer({ operation: label });
          try {
            return await query(args);
          } finally {
            end();
            dbQueryTotal.inc({ operation: label });
          }
        },
      },
    },
  });
  // Le client étendu a bien toutes les méthodes utilisées ailleurs dans le code (délégués de
  // modèles, $transaction) mais son type TS diffère techniquement de PrismaClient (il lui
  // manque $on, jamais utilisé dans ce codebase) - ce cast reflète la compatibilité réelle
  // plutôt que de forcer un changement de type dans les ~30 repositories qui attendent PrismaClient.
  return extended as unknown as PrismaClient;
}
