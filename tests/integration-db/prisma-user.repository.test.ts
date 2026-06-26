import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { DB_AVAILABLE, getPrisma,  cleanDatabase, disconnectPrisma } from './setup.js';
import { PrismaUserRepository } from '../../src/infrastructure/database/repositories/prisma-user.repository.js';
import { Role } from '../../src/domain/enums.js';

beforeAll(async () => {
}, 60_000);

afterAll(async () => {
  if (DB_AVAILABLE) {
    await cleanDatabase();
    await disconnectPrisma();
  }
});

describe.skipIf(!DB_AVAILABLE)('PrismaUserRepository', () => {
  let repo: PrismaUserRepository;

  beforeAll(() => {
    repo = new PrismaUserRepository(getPrisma());
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  const makeUser = (overrides: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuAAAAAAAAAAAAAAAAAAAAAAAA',
    firstName: 'John',
    lastName: 'Doe',
    avatar: null,
    role: Role.VIEWER,
    isActive: true,
    emailVerifiedAt: null,
    lastLoginAt: null,
    ...overrides,
  });

  it('should create a user', async () => {
    const data = makeUser();
    const user = await repo.create(data);
    expect(user.id).toBe(data.id);
    expect(user.email).toBe(data.email);
    expect(user.firstName).toBe('John');
  });

  it('should find by email', async () => {
    const data = makeUser({ email: 'findme@test.com' });
    await repo.create(data);

    const found = await repo.findByEmail('findme@test.com');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(data.id);

    const notFound = await repo.findByEmail('nonexistent@test.com');
    expect(notFound).toBeNull();
  });

  it('should update a user', async () => {
    const data = makeUser();
    await repo.create(data);

    const updated = await repo.update(data.id, { firstName: 'Jane', role: Role.EDITOR });
    expect(updated.firstName).toBe('Jane');
    expect(updated.role).toBe(Role.EDITOR);
  });

  it('should delete a user', async () => {
    const data = makeUser();
    await repo.create(data);
    await repo.delete(data.id);

    const found = await repo.findById(data.id);
    expect(found).toBeNull();
  });

  it('should existsByEmail', async () => {
    const data = makeUser({ email: 'exists@test.com' });
    await repo.create(data);

    expect(await repo.existsByEmail('exists@test.com')).toBe(true);
    expect(await repo.existsByEmail('nope@test.com')).toBe(false);
  });

  it('should findAll with search and pagination', async () => {
    await repo.create(makeUser({ firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' }));
    await repo.create(makeUser({ firstName: 'Bob', lastName: 'Jones', email: 'bob@test.com' }));

    const all = await repo.findAll();
    expect(all.total).toBe(2);

    const searched = await repo.findAll({ search: 'Alice' });
    expect(searched.total).toBe(1);
    expect(searched.data[0].firstName).toBe('Alice');
  });
});
