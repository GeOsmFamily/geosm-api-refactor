/**
 * Catalogue des notifications sociales de GeOsm Family (cahier technique, chapitre 5.7).
 *
 * `Notification.type` est une chaine libre : aucune migration n'est necessaire. Ces constantes
 * documentent les neuf types a venir et la forme exacte de leur payload. Aucun n'est emis a ce
 * stade ; chaque declencheur est branche avec son use case (POST_LIKED et POST_COMMENTED en
 * phase 2, les autres en phase 3).
 */
export const SocialNotificationType = {
  POST_LIKED: 'POST_LIKED',
  POST_COMMENTED: 'POST_COMMENTED',
  GROUP_INVITE: 'GROUP_INVITE',
  GROUP_JOIN_REQUEST_ACCEPTED: 'GROUP_JOIN_REQUEST_ACCEPTED',
  EVENT_REMINDER: 'EVENT_REMINDER',
  CONNECTION_REQUEST: 'CONNECTION_REQUEST',
  CONNECTION_ACCEPTED: 'CONNECTION_ACCEPTED',
  NEW_PROJECT_IN_ZONE: 'NEW_PROJECT_IN_ZONE',
  BADGE_UNLOCKED: 'BADGE_UNLOCKED',
} as const;

export type SocialNotificationType =
  (typeof SocialNotificationType)[keyof typeof SocialNotificationType];

export interface SocialNotificationPayloads {
  POST_LIKED: { postId: string; likedByUserId: string; likedByName: string };
  POST_COMMENTED: {
    postId: string;
    commentId: string;
    authorId: string;
    authorName: string;
    excerpt: string;
  };
  /** Reserve : non exposee par l'API v2. */
  GROUP_INVITE: { groupId: string; groupName: string; invitedByUserId: string };
  GROUP_JOIN_REQUEST_ACCEPTED: { groupId: string; groupName: string };
  EVENT_REMINDER: {
    eventId: string;
    eventTitle: string;
    startsAt: string;
    kind: 'REMINDER' | 'CANCELLED';
  };
  CONNECTION_REQUEST: { connectionId: string; requesterId: string; requesterName: string };
  CONNECTION_ACCEPTED: { connectionId: string; addresseeId: string; addresseeName: string };
  NEW_PROJECT_IN_ZONE: ({ eventId: string } | { postId: string }) & { distanceMeters: number };
  BADGE_UNLOCKED: { badgeId: string; badgeCode: string; badgeLabel: string };
}

export const SOCIAL_NOTIFICATION_TYPES: readonly SocialNotificationType[] =
  Object.values(SocialNotificationType);

/** Categories des preferences (ecran Parametres, RG-C) : un interrupteur par categorie. */
export const NotificationCategory = {
  REACTIONS: 'REACTIONS',
  GROUPS: 'GROUPS',
  EVENTS: 'EVENTS',
  CONNECTIONS: 'CONNECTIONS',
  ZONE: 'ZONE',
  BADGES: 'BADGES',
} as const;

export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] =
  Object.values(NotificationCategory);

const CATEGORY_BY_TYPE: Record<SocialNotificationType, NotificationCategory> = {
  POST_LIKED: 'REACTIONS',
  POST_COMMENTED: 'REACTIONS',
  GROUP_INVITE: 'GROUPS',
  GROUP_JOIN_REQUEST_ACCEPTED: 'GROUPS',
  EVENT_REMINDER: 'EVENTS',
  CONNECTION_REQUEST: 'CONNECTIONS',
  CONNECTION_ACCEPTED: 'CONNECTIONS',
  NEW_PROJECT_IN_ZONE: 'ZONE',
  BADGE_UNLOCKED: 'BADGES',
};

/** Categorie d'un type de notification ; `null` pour les types historiques (non filtrables). */
export function categoryOf(type: string): NotificationCategory | null {
  return (CATEGORY_BY_TYPE as Record<string, NotificationCategory>)[type] ?? null;
}
