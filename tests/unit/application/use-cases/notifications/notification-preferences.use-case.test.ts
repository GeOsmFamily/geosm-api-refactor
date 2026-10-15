import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationPreferencesUseCases } from '../../../../../src/application/use-cases/notifications/notification-preferences.use-case.js';

describe('NotificationPreferencesUseCases', () => {
  let repo: { listPreferences: ReturnType<typeof vi.fn>; setPreference: ReturnType<typeof vi.fn> };
  let useCases: NotificationPreferencesUseCases;

  beforeEach(() => {
    repo = {
      listPreferences: vi.fn().mockResolvedValue({ ZONE: false }),
      setPreference: vi.fn().mockResolvedValue(undefined),
    };
    useCases = new NotificationPreferencesUseCases(repo as never);
  });

  it('active toutes les categories par defaut sauf choix explicite', async () => {
    const prefs = await useCases.get('u1');
    expect(prefs.ZONE).toBe(false);
    expect(prefs.REACTIONS).toBe(true);
    expect(Object.keys(prefs).sort()).toEqual(['BADGES', 'CONNECTIONS', 'EVENTS', 'GROUPS', 'REACTIONS', 'ZONE']);
  });

  it('enregistre uniquement les categories valides', async () => {
    await useCases.update('u1', { GROUPS: false, INCONNUE: false });
    expect(repo.setPreference).toHaveBeenCalledTimes(1);
    expect(repo.setPreference).toHaveBeenCalledWith('u1', 'GROUPS', false);
  });
});
