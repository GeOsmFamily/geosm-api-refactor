import { describe, it, expect } from 'vitest';
import {
  SOCIAL_NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  categoryOf,
} from '../../../src/domain/notifications/social-notification-types.js';
import { JOB_EVENT_PREFIXES } from '../../../src/infrastructure/database/repositories/prisma-notification.repository.js';

describe('catalogue des notifications sociales', () => {
  it('contient les neuf types du cahier technique 5.7', () => {
    expect([...SOCIAL_NOTIFICATION_TYPES].sort()).toEqual(
      [
        'BADGE_UNLOCKED',
        'CONNECTION_ACCEPTED',
        'CONNECTION_REQUEST',
        'EVENT_REMINDER',
        'GROUP_INVITE',
        'GROUP_JOIN_REQUEST_ACCEPTED',
        'NEW_PROJECT_IN_ZONE',
        'POST_COMMENTED',
        'POST_LIKED',
      ].sort(),
    );
  });

  it('rattache chaque type a une categorie connue', () => {
    for (const type of SOCIAL_NOTIFICATION_TYPES) {
      expect(NOTIFICATION_CATEGORIES).toContain(categoryOf(type));
    }
  });

  it('ne filtre pas les types historiques ni les taches de fond', () => {
    expect(categoryOf('comment-reply')).toBeNull();
    expect(categoryOf('export:progress')).toBeNull();
  });

  it('aucun type social ne collisionne avec un prefixe de tache de fond', () => {
    for (const type of SOCIAL_NOTIFICATION_TYPES) {
      expect(JOB_EVENT_PREFIXES.some((p) => type.startsWith(p))).toBe(false);
    }
  });
});
