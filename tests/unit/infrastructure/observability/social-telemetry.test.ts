import { describe, it, expect, vi } from 'vitest';
import {
  assertEventName,
  createSocialCounter,
  createSocialHistogram,
  logSocialEvent,
  withUseCaseSpan,
} from '../../../../src/infrastructure/observability/social-telemetry.js';
import { metricsRegister } from '../../../../src/infrastructure/observability/metrics.js';

function fakeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('logSocialEvent', () => {
  it('ajoute toujours event, requestId, userId et instanceId', () => {
    const log = fakeLogger();
    logSocialEvent(log, 'info', 'post.created', {
      requestId: 'req-1',
      userId: 'u1',
      instanceId: 'i1',
    });

    expect(log.info).toHaveBeenCalledWith('post.created', {
      event: 'post.created',
      requestId: 'req-1',
      userId: 'u1',
      instanceId: 'i1',
    });
  });

  it('met null pour un visiteur non authentifie plutot que de supprimer le champ', () => {
    const log = fakeLogger();
    logSocialEvent(log, 'info', 'instance.selected', { instanceId: 'i1' });

    const meta = log.info.mock.calls[0][1];
    expect(meta).toMatchObject({ userId: null, requestId: null, instanceId: 'i1' });
    expect(Object.keys(meta)).toEqual(
      expect.arrayContaining(['event', 'requestId', 'userId', 'instanceId']),
    );
  });

  it('empeche extra d\'ecraser les champs obligatoires', () => {
    const log = fakeLogger();
    logSocialEvent(log, 'warn', 'post.deleted', { userId: 'u1', instanceId: 'i1' }, {
      userId: 'usurpe',
      event: 'autre',
      postId: 'p1',
    });

    expect(log.warn.mock.calls[0][1]).toMatchObject({
      userId: 'u1',
      event: 'post.deleted',
      postId: 'p1',
    });
  });

  it('rejette un nom d\'evenement mal forme', () => {
    expect(() => assertEventName('PostCreated')).toThrow(TypeError);
    expect(() => assertEventName('post')).toThrow(TypeError);
    expect(() => assertEventName('group.member_joined')).not.toThrow();
  });
});

describe('metriques sociales', () => {
  it('prefixe geosm_social_ et place instance_id en premier label', async () => {
    const counter = createSocialCounter('test_posts_created_total', 'test', ['visibility']);
    counter.inc({ instance_id: 'cm', visibility: 'PUBLIC' });

    const output = await metricsRegister.metrics();
    expect(output).toContain('geosm_social_test_posts_created_total{instance_id="cm",visibility="PUBLIC"} 1');
  });

  it('est idempotent pour un meme nom', () => {
    const a = createSocialCounter('test_idempotent_total', 'test');
    const b = createSocialCounter('test_idempotent_total', 'test');
    expect(a).toBe(b);
  });

  it('impose les suffixes _total et _seconds', () => {
    expect(() => createSocialCounter('test_bad', 'x')).toThrow(/_total/);
    expect(() => createSocialHistogram('test_bad', 'x')).toThrow(/_seconds/);
    expect(() => createSocialCounter('Bad-Name_total', 'x')).toThrow(TypeError);
    expect(() => createSocialHistogram('test_feed_query_duration_seconds', 'x')).not.toThrow();
  });
});

describe('withUseCaseSpan', () => {
  it('retourne la valeur du use case', async () => {
    const result = await withUseCaseSpan('CreatePostUseCase', { userId: 'u1', instanceId: 'i1' }, async () => 42);
    expect(result).toBe(42);
  });

  it('propage l\'erreur d\'origine', async () => {
    const boom = new Error('boom');
    await expect(
      withUseCaseSpan('CreatePostUseCase', {}, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
