import type { PrismaNotificationRepository } from '../../../infrastructure/database/repositories/prisma-notification.repository.js';

export interface UnreadCounters {
  notifications: number;
  messages: number;
}

/**
 * Compteurs des pastilles de la barre de navigation (onglets Notification et Message), sous une
 * forme resserree pour ne pas charger la liste complete a chaque rafraichissement.
 *
 * `messages` vaut 0 tant que la messagerie n'existe pas (etape 3.3) : le champ fait deja partie du
 * contrat pour que le frontend n'ait pas a changer.
 */
export class GetUnreadCountersUseCase {
  constructor(private readonly notificationRepository: PrismaNotificationRepository) {}

  async execute(userId: string): Promise<UnreadCounters> {
    const notifications = await this.notificationRepository.countUnreadSocial(userId);
    return { notifications, messages: 0 };
  }
}
