import { asFunction, Lifetime } from 'awilix';
import type { PrismaNotificationRepository } from '../infrastructure/database/repositories/prisma-notification.repository.js';
import { GetUnreadCountersUseCase } from '../application/use-cases/notifications/get-unread-counters.use-case.js';
import { NotificationPreferencesUseCases } from '../application/use-cases/notifications/notification-preferences.use-case.js';
import type { DomainRegistration } from './domain-registrations.js';

interface NotificationsCradle {
  notificationRepository: PrismaNotificationRepository;
}

/** Extensions du centre de notifications pour GeOsm Family (compteurs, puis types sociaux). */
export const notificationsRegistrations: DomainRegistration = () => ({
  getUnreadCountersUseCase: asFunction(
    (c: NotificationsCradle) => new GetUnreadCountersUseCase(c.notificationRepository),
    { lifetime: Lifetime.SCOPED },
  ),
  notificationPreferencesUseCases: asFunction(
    (c: NotificationsCradle) => new NotificationPreferencesUseCases(c.notificationRepository),
    { lifetime: Lifetime.SCOPED },
  ),
});
