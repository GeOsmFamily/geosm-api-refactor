import { describe, it, expect } from 'vitest';
import { asValue } from 'awilix';
import type { PrismaClient } from '@prisma/client';
import {
  collectDomainRegistrations,
  domainRegistrations,
} from '../../../src/di/domain-registrations.js';

const deps = { prisma: {} as PrismaClient };

describe('collectDomainRegistrations', () => {
  it('enregistre les domaines Territoire, Notifications et Auth', () => {
    expect(domainRegistrations.length).toBeGreaterThan(0);
    expect(Object.keys(collectDomainRegistrations(deps)).sort()).toEqual([
      'completeProfileUseCase',
      'contentReportRepository',
      'getInstanceChildrenUseCase',
      'getInstanceTreeUseCase',
      'getUnreadCountersUseCase',
      'notificationPreferencesUseCases',
      'postCommentsUseCases',
      'postMediaUseCase',
      'postModerationUseCases',
      'postRepository',
      'postsUseCases',
      'predefinedCommentRepository',
      'predefinedCommentsUseCases',
      'resendVerificationUseCase',
      'setPreferredInstanceUseCase',
      'updateInstanceHierarchyUseCase',
    ]);
  });

  it('fusionne les resolvers de plusieurs domaines', () => {
    const merged = collectDomainRegistrations(deps, [
      () => ({ postRepository: asValue('post') }),
      () => ({ groupRepository: asValue('group') }),
    ]);
    expect(Object.keys(merged).sort()).toEqual(['groupRepository', 'postRepository']);
  });

  it('refuse une cle d\'injection declaree par deux domaines', () => {
    expect(() =>
      collectDomainRegistrations(deps, [
        () => ({ shared: asValue(1) }),
        () => ({ shared: asValue(2) }),
      ]),
    ).toThrow(/dupliquee.*shared/);
  });
});
