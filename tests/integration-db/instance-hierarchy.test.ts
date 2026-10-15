import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { DB_AVAILABLE, getPrisma, cleanDatabase, disconnectPrisma } from './setup.js';
import { PrismaInstanceRepository } from '../../src/infrastructure/database/repositories/prisma-instance.repository.js';
import { PrismaUserRepository } from '../../src/infrastructure/database/repositories/prisma-user.repository.js';
import { GetInstanceTreeUseCase } from '../../src/application/use-cases/instances/get-instance-tree.use-case.js';
import { GetInstanceChildrenUseCase } from '../../src/application/use-cases/instances/get-instance-children.use-case.js';
import { UpdateInstanceHierarchyUseCase } from '../../src/application/use-cases/instances/update-instance-hierarchy.use-case.js';
import { SetPreferredInstanceUseCase } from '../../src/application/use-cases/users/set-preferred-instance.use-case.js';
import { InvalidHierarchyError } from '../../src/domain/errors/invalid-hierarchy.error.js';
import { ConflictError } from '../../src/domain/errors/conflict.error.js';
import { InstanceKind, Role } from '../../src/domain/enums.js';
import { seedTerritories } from '../../prisma/territories.js';

afterAll(async () => {
  if (DB_AVAILABLE) {
    await cleanDatabase();
    await disconnectPrisma();
  }
});

describe.skipIf(!DB_AVAILABLE)('Hierarchie territoriale (base reelle)', () => {
  let repo: PrismaInstanceRepository;

  beforeAll(() => {
    repo = new PrismaInstanceRepository(getPrisma());
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  it('cree un pays COUNTRY par defaut, sans parent', async () => {
    const created = await repo.create({
      id: crypto.randomUUID(), name: 'Cameroun', slug: 'cameroon', description: null, logo: null,
      bbox: [], centerLat: null, centerLon: null, defaultZoom: 6, boundaryTable: null, boundaryId: null,
      boundaryGeomCol: null, adminLevel: null, parentInstanceId: null, isActive: true,
    });
    expect(created.kind).toBe(InstanceKind.COUNTRY);
    expect(created.parentInstanceId).toBeNull();
    expect(created.continentCode).toBeNull();
  });

  it('construit l\'arbre apres le seed et le rend idempotent', async () => {
    await seedTerritories(getPrisma());
    await seedTerritories(getPrisma());

    const tree = await new GetInstanceTreeUseCase(repo).execute();
    expect(tree).toHaveLength(6);
    const africa = tree.find((n) => n.slug === 'afrique')!;
    expect(africa.children).toHaveLength(54);
    expect(africa.children.find((c) => c.slug === 'cameroon')).toMatchObject({
      isActive: true,
      continentCode: 'AF',
    });
    expect(africa.children.filter((c) => c.isActive)).toHaveLength(1);
  });

  it('refuse en base un rattachement pays -> pays (422) et accepte pays -> continent', async () => {
    await seedTerritories(getPrisma());
    const update = new UpdateInstanceHierarchyUseCase(repo);
    const chad = (await repo.findBySlug('tchad'))!;
    const cameroon = (await repo.findBySlug('cameroon'))!;

    await expect(update.execute(chad.id, { parentInstanceId: cameroon.id })).rejects.toBeInstanceOf(
      InvalidHierarchyError,
    );

    const europe = (await repo.findBySlug('europe'))!;
    const moved = await update.execute(chad.id, { parentInstanceId: europe.id });
    expect(moved.parentInstanceId).toBe(europe.id);
    expect(moved.continentCode).toBe('EU');
  });

  it('propage un changement de code continent a tous les pays', async () => {
    await seedTerritories(getPrisma());
    const africa = (await repo.findBySlug('afrique'))!;
    await new UpdateInstanceHierarchyUseCase(repo).execute(africa.id, { continentCode: 'AFR' });

    const children = await new GetInstanceChildrenUseCase(repo).execute(africa.id);
    expect(children).toHaveLength(54);
    expect(children.every((c) => c.continentCode === 'AFR')).toBe(true);
  });

  it('detache les enfants (SET NULL) quand le continent est supprime', async () => {
    await seedTerritories(getPrisma());
    const africa = (await repo.findBySlug('afrique'))!;
    await repo.delete(africa.id);

    const chad = (await repo.findBySlug('tchad'))!;
    expect(chad.parentInstanceId).toBeNull();
  });

  it('memorise le pays prefere, refuse un pays inactif et se remet a null a la suppression', async () => {
    await seedTerritories(getPrisma());
    const userRepo = new PrismaUserRepository(getPrisma());
    const user = await userRepo.create({
      id: crypto.randomUUID(), email: 'u@test.dev', passwordHash: 'x', firstName: 'A', lastName: 'B',
      avatar: null, role: Role.VIEWER, isActive: true, emailVerifiedAt: null, lastLoginAt: null,
    });
    const setPreferred = new SetPreferredInstanceUseCase(userRepo, repo);
    const cameroon = (await repo.findBySlug('cameroon'))!;
    const chad = (await repo.findBySlug('tchad'))!;

    await setPreferred.execute(user.id, cameroon.id);
    expect((await userRepo.findById(user.id))!.preferredInstanceId).toBe(cameroon.id);

    await expect(setPreferred.execute(user.id, chad.id)).rejects.toBeInstanceOf(ConflictError);

    await getPrisma().instance.update({ where: { id: cameroon.id }, data: { parentInstanceId: null } });
    await repo.delete(cameroon.id);
    expect((await userRepo.findById(user.id))!.preferredInstanceId).toBeNull();
  });

  it('filtre la liste des instances par kind', async () => {
    await seedTerritories(getPrisma());
    const continents = await repo.findAll({ kind: InstanceKind.CONTINENT, limit: 100 });
    expect(continents.total).toBe(6);
    const countries = await repo.findAll({ kind: InstanceKind.COUNTRY, limit: 100 });
    expect(countries.total).toBe(77);
  });
});
