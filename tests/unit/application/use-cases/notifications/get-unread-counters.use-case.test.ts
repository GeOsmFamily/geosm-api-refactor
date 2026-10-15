import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { GetUnreadCountersUseCase } from '../../../../../src/application/use-cases/notifications/get-unread-counters.use-case.js';
import {
  JOB_EVENT_PREFIXES,
  PrismaNotificationRepository,
} from '../../../../../src/infrastructure/database/repositories/prisma-notification.repository.js';

describe('PrismaNotificationRepository.countUnreadSocial', () => {
  it('compte les non-lus de l\'utilisateur en excluant tous les evenements de taches de fond', async () => {
    const count = vi.fn().mockResolvedValue(3);
    const repo = new PrismaNotificationRepository({ notification: { count } } as unknown as PrismaClient);

    await expect(repo.countUnreadSocial('user-1')).resolves.toBe(3);

    expect(count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        readAt: null,
        NOT: {
          OR: [
            { type: { startsWith: 'export:' } },
            { type: { startsWith: 'import:' } },
            { type: { startsWith: 'location-plan:' } },
            { type: { startsWith: 'analysis-report:' } },
          ],
        },
      },
    });
  });

  it('exclut les memes familles que le panneau de notifications du frontend', () => {
    expect([...JOB_EVENT_PREFIXES]).toEqual(['export:', 'import:', 'location-plan:', 'analysis-report:']);
  });
});

describe('GetUnreadCountersUseCase', () => {
  it('retourne les notifications non lues et 0 message tant que la messagerie n\'existe pas', async () => {
    const repo = { countUnreadSocial: vi.fn().mockResolvedValue(12) };
    const result = await new GetUnreadCountersUseCase(repo as never).execute('user-1');

    expect(result).toEqual({ notifications: 12, messages: 0 });
    expect(repo.countUnreadSocial).toHaveBeenCalledWith('user-1');
  });
});
