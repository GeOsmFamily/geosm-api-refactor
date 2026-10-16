import type { PrismaClient } from '@prisma/client';

/**
 * Commentaires predefinis proposes par defaut aux pays ouverts (outil « Ajouter un commentaire »,
 * maquette 14). Un par type de signalement existant (CommentReportType), plus un message libre.
 * Les administrateurs de chaque pays les modifient ensuite depuis le back-office.
 *
 * Idempotent : une instance qui a deja au moins un commentaire predefini n'est jamais touchee.
 */
export const DEFAULT_PREDEFINED_COMMENTS = [
  'Ce lieu est fermé ou n’existe plus',
  'Une information affichée est erronée',
  'Le tracé ou la position est à mettre à jour',
  'Route ou accès en mauvais état',
  'Autre remarque',
];

export async function seedPredefinedComments(prisma: PrismaClient): Promise<number> {
  const instances = await prisma.instance.findMany({
    where: { isActive: true, kind: { not: 'CONTINENT' } },
    select: { id: true, _count: { select: { predefinedComments: true } } },
  });
  let seeded = 0;
  for (const instance of instances) {
    if (instance._count.predefinedComments > 0) continue;
    await prisma.predefinedComment.createMany({
      data: DEFAULT_PREDEFINED_COMMENTS.map((label, order) => ({
        instanceId: instance.id,
        label,
        order,
      })),
    });
    seeded++;
  }
  return seeded;
}
