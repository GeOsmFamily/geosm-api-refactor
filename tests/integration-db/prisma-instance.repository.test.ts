import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { DB_AVAILABLE, getPrisma, applyMigrations, cleanDatabase, disconnectPrisma } from './setup.js';
import { PrismaInstanceRepository } from '../../src/infrastructure/database/repositories/prisma-instance.repository.js';
import { PrismaUserRepository } from '../../src/infrastructure/database/repositories/prisma-user.repository.js';
import { Role } from '../../src/domain/enums.js';

beforeAll(async () => {
  if (DB_AVAILABLE) await applyMigrations();
}, 60_000);

afterAll(async () => {
  if (DB_AVAILABLE) {
    await cleanDatabase();
    await disconnectPrisma();
  }
});

describe.skipIf(!DB_AVAILABLE)('PrismaInstanceRepository', () => {
  let repo: PrismaInstanceRepository;
  let userRepo: PrismaUserRepository;

  beforeAll(() => {
    const prisma = getPrisma();
    repo = new PrismaInstanceRepository(prisma);
    userRepo = new PrismaUserRepository(prisma);
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  const makeInstance = (overrides: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    name: 'Test Instance',
    slug: `test-${Date.now()}`,
    description: 'A test instance',
    logo: null,
    bbox: [1.0, 2.0, 3.0, 4.0],
    centerLat: 3.85,
    centerLon: 11.5,
    defaultZoom: 8,
    boundaryTable: null,
    boundaryId: null,
    boundaryGeomCol: null,
    adminLevel: null,
    parentInstanceId: null,
    isActive: true,
    ...overrides,
  }) as any;

  const makeUser = (overrides: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    email: `user-${Date.now()}@test.com`,
    passwordHash: '$2b$10$hashedpasswordhere',
    firstName: 'Test',
    lastName: 'User',
    avatar: null,
    role: Role.VIEWER,
    isActive: true,
    emailVerifiedAt: null,
    lastLoginAt: null,
    ...overrides,
  });

  it('should create an instance and find it by id', async () => {
    const data = makeInstance();
    const created = await repo.create(data);
    expect(created.id).toBe(data.id);
    expect(created.name).toBe('Test Instance');

    const found = await repo.findById(data.id);
    expect(found).not.toBeNull();
    expect(found!.slug).toBe(data.slug);
  });

  it('should findBySlug', async () => {
    const data = makeInstance({ slug: 'unique-slug-test' });
    await repo.create(data);

    const found = await repo.findBySlug('unique-slug-test');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Test Instance');
  });

  it('should findAll with pagination and search', async () => {
    await repo.create(makeInstance({ name: 'Alpha Instance', slug: 'alpha' }));
    await repo.create(makeInstance({ name: 'Beta Instance', slug: 'beta' }));
    await repo.create(makeInstance({ name: 'Gamma Instance', slug: 'gamma' }));

    const all = await repo.findAll({ page: 1, limit: 10 });
    expect(all.total).toBe(3);
    expect(all.data).toHaveLength(3);

    const searched = await repo.findAll({ search: 'Alpha' });
    expect(searched.total).toBe(1);
    expect(searched.data[0].name).toBe('Alpha Instance');

    const page2 = await repo.findAll({ page: 2, limit: 2 });
    expect(page2.data).toHaveLength(1);
  });

  it('should update an instance', async () => {
    const data = makeInstance();
    await repo.create(data);

    const updated = await repo.update(data.id, { name: 'Updated Name', defaultZoom: 12 });
    expect(updated.name).toBe('Updated Name');
    expect(updated.defaultZoom).toBe(12);
  });

  it('should delete an instance', async () => {
    const data = makeInstance();
    await repo.create(data);
    await repo.delete(data.id);

    const found = await repo.findById(data.id);
    expect(found).toBeNull();
  });

  describe('instance user management', () => {
    it('should add, find, change role, and remove instance users', async () => {
      const instData = makeInstance();
      await repo.create(instData);

      const userData = makeUser();
      await userRepo.create(userData);

      // Add user to instance
      const iu = await repo.addInstanceUser(instData.id, userData.id, Role.EDITOR);
      expect(iu.role).toBe(Role.EDITOR);
      expect(iu.userId).toBe(userData.id);

      // Find instance user
      const found = await repo.findInstanceUser(instData.id, userData.id);
      expect(found).not.toBeNull();
      expect(found!.role).toBe(Role.EDITOR);

      // List instance users
      const users = await repo.findInstanceUsers(instData.id);
      expect(users).toHaveLength(1);

      // Change role
      const changed = await repo.changeInstanceUserRole(instData.id, userData.id, Role.ADMIN_INSTANCE);
      expect(changed.role).toBe(Role.ADMIN_INSTANCE);

      // Remove
      await repo.removeInstanceUser(instData.id, userData.id);
      const afterRemove = await repo.findInstanceUser(instData.id, userData.id);
      expect(afterRemove).toBeNull();
    });
  });

  it('should handle boundary fields', async () => {
    const data = makeInstance({
      boundaryTable: 'admin_boundaries',
      boundaryId: 42,
      boundaryGeomCol: 'geom',
      adminLevel: 2,
    });
    const created = await repo.create(data);
    const found = await repo.findById(created.id);
    expect(found).not.toBeNull();
    // These fields exist on the schema; verify no errors
    expect(found!.id).toBe(data.id);
  });
});
