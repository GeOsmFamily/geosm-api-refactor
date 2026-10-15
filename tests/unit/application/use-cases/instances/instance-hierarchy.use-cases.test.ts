import { describe, it, expect, beforeEach } from 'vitest';
import { Instance, type InstanceProps } from '../../../../../src/domain/entities/instance.entity.js';
import { InstanceKind } from '../../../../../src/domain/enums.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { GetInstanceTreeUseCase } from '../../../../../src/application/use-cases/instances/get-instance-tree.use-case.js';
import { GetInstanceChildrenUseCase } from '../../../../../src/application/use-cases/instances/get-instance-children.use-case.js';
import { UpdateInstanceHierarchyUseCase } from '../../../../../src/application/use-cases/instances/update-instance-hierarchy.use-case.js';
import { InvalidHierarchyError } from '../../../../../src/domain/errors/invalid-hierarchy.error.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

const now = new Date();

function make(id: string, name: string, over: Partial<InstanceProps> = {}): Instance {
  return new Instance({
    id,
    name,
    slug: id,
    description: null,
    logo: null,
    bbox: null,
    centerLat: null,
    centerLon: null,
    defaultZoom: 6,
    boundaryTable: null,
    boundaryId: null,
    boundaryGeomCol: null,
    adminLevel: null,
    parentInstanceId: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...over,
  });
}

/** Repository en memoire : seules les methodes utilisees par les use cases testes. */
function fakeRepo(initial: Instance[]) {
  const store = new Map(initial.map((i) => [i.id, i]));
  const repo = {
    findById: async (id: string) => store.get(id) ?? null,
    findAllForTree: async () => [...store.values()],
    findChildren: async (parentId: string) =>
      [...store.values()].filter((i) => i.parentInstanceId === parentId),
    update: async (id: string, data: Partial<InstanceProps>) => {
      const current = store.get(id)!;
      const next = new Instance({ ...(current as unknown as InstanceProps), ...data });
      store.set(id, next);
      return next;
    },
  };
  return { repo: repo as unknown as IInstanceRepository, store };
}

describe('GetInstanceTreeUseCase', () => {
  it('imbrique les pays sous leur continent et inclut les pays inactifs', async () => {
    const { repo } = fakeRepo([
      make('africa', 'Afrique', { kind: InstanceKind.CONTINENT, continentCode: 'AF', isActive: false }),
      make('cm', 'Cameroun', { parentInstanceId: 'africa', continentCode: 'AF' }),
      make('td', 'Tchad', { parentInstanceId: 'africa', continentCode: 'AF', isActive: false }),
      make('europe', 'Europe', { kind: InstanceKind.CONTINENT, continentCode: 'EU', isActive: false }),
    ]);

    const tree = await new GetInstanceTreeUseCase(repo).execute();

    expect(tree.map((n) => n.id)).toEqual(['africa', 'europe']);
    const africa = tree[0];
    expect(africa.children.map((c) => c.id)).toEqual(['cm', 'td']);
    expect(africa.children.find((c) => c.id === 'td')?.isActive).toBe(false);
    expect(africa.children[0].children).toEqual([]);
  });

  it('garde a la racine un pays sans parent (anterieur a la hierarchie)', async () => {
    const { repo } = fakeRepo([make('cm', 'Cameroun'), make('africa', 'Afrique', { kind: InstanceKind.CONTINENT })]);
    const tree = await new GetInstanceTreeUseCase(repo).execute();
    expect(tree.map((n) => n.id).sort()).toEqual(['africa', 'cm']);
  });

  it('trie par nom sans tenir compte des accents', async () => {
    const { repo } = fakeRepo([
      make('b', 'Égypte', { kind: InstanceKind.CONTINENT }),
      make('a', 'Algérie', { kind: InstanceKind.CONTINENT }),
      make('c', 'Zambie', { kind: InstanceKind.CONTINENT }),
    ]);
    const tree = await new GetInstanceTreeUseCase(repo).execute();
    expect(tree.map((n) => n.name)).toEqual(['Algérie', 'Égypte', 'Zambie']);
  });

  it('retourne un arbre vide quand il n\'y a aucune instance', async () => {
    const { repo } = fakeRepo([]);
    expect(await new GetInstanceTreeUseCase(repo).execute()).toEqual([]);
  });
});

describe('GetInstanceChildrenUseCase', () => {
  it('retourne les enfants directs', async () => {
    const { repo } = fakeRepo([
      make('africa', 'Afrique', { kind: InstanceKind.CONTINENT }),
      make('cm', 'Cameroun', { parentInstanceId: 'africa' }),
    ]);
    const children = await new GetInstanceChildrenUseCase(repo).execute('africa');
    expect(children.map((c) => c.id)).toEqual(['cm']);
  });

  it('leve NotFoundError pour une instance inconnue', async () => {
    const { repo } = fakeRepo([]);
    await expect(new GetInstanceChildrenUseCase(repo).execute('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('UpdateInstanceHierarchyUseCase', () => {
  let store: Map<string, Instance>;
  let useCase: UpdateInstanceHierarchyUseCase;

  beforeEach(() => {
    const fake = fakeRepo([
      make('africa', 'Afrique', { kind: InstanceKind.CONTINENT, continentCode: 'AF' }),
      make('europe', 'Europe', { kind: InstanceKind.CONTINENT, continentCode: 'EU' }),
      make('cm', 'Cameroun'),
      make('td', 'Tchad', { parentInstanceId: 'africa', continentCode: 'AF' }),
      make('centre', 'Centre', { kind: InstanceKind.REGION, parentInstanceId: 'cm' }),
    ]);
    store = fake.store;
    useCase = new UpdateInstanceHierarchyUseCase(fake.repo);
  });

  it('rattache un pays a un continent et en deduit le code continent', async () => {
    const result = await useCase.execute('cm', { parentInstanceId: 'africa' });
    expect(result.parentInstanceId).toBe('africa');
    expect(result.continentCode).toBe('AF');
  });

  it('propage le code continent aux regions du pays', async () => {
    await useCase.execute('cm', { parentInstanceId: 'africa' });
    expect(store.get('centre')?.continentCode).toBe('AF');
  });

  it('refuse de rattacher un pays a un autre pays (INVALID_HIERARCHY, 422)', async () => {
    const error = await useCase.execute('cm', { parentInstanceId: 'td' }).catch((e) => e);
    expect(error).toBeInstanceOf(InvalidHierarchyError);
    expect(error.code).toBe('INVALID_HIERARCHY');
    expect(error.statusCode).toBe(422);
  });

  it('refuse un parent pour un continent', async () => {
    await expect(
      useCase.execute('africa', { parentInstanceId: 'europe' }),
    ).rejects.toBeInstanceOf(InvalidHierarchyError);
  });

  it('refuse une region sans parent et une region rattachee a un continent', async () => {
    await expect(useCase.execute('centre', { parentInstanceId: null })).rejects.toBeInstanceOf(InvalidHierarchyError);
    await expect(useCase.execute('centre', { parentInstanceId: 'africa' })).rejects.toBeInstanceOf(InvalidHierarchyError);
  });

  it('refuse qu\'une instance soit son propre parent', async () => {
    await expect(useCase.execute('cm', { parentInstanceId: 'cm' })).rejects.toBeInstanceOf(InvalidHierarchyError);
  });

  it('leve NotFoundError si le parent n\'existe pas', async () => {
    await expect(useCase.execute('cm', { parentInstanceId: 'ghost' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(useCase.execute('ghost', {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuse de changer le niveau d\'un noeud dont les enfants deviendraient incoherents', async () => {
    const error = await useCase.execute('africa', { kind: InstanceKind.COUNTRY }).catch((e) => e);
    expect(error).toBeInstanceOf(InvalidHierarchyError);
    expect(error.details.incompatibleChildren).toEqual(['td']);
  });

  it('refuse de saisir un code continent sur un pays', async () => {
    await expect(
      useCase.execute('cm', { parentInstanceId: 'africa', continentCode: 'EU' }),
    ).rejects.toBeInstanceOf(InvalidHierarchyError);
  });

  it('propage un nouveau code continent aux pays et regions', async () => {
    await useCase.execute('cm', { parentInstanceId: 'africa' });
    await useCase.execute('africa', { continentCode: 'AFR' });
    expect(store.get('td')?.continentCode).toBe('AFR');
    expect(store.get('cm')?.continentCode).toBe('AFR');
    expect(store.get('centre')?.continentCode).toBe('AFR');
  });

  it('detache un pays (parent null) et efface son code continent', async () => {
    const result = await useCase.execute('td', { parentInstanceId: null });
    expect(result.parentInstanceId).toBeNull();
    expect(result.continentCode).toBeNull();
  });

  it('met a jour l\'icone de drapeau sans toucher a la hierarchie', async () => {
    const result = await useCase.execute('td', { flagIconUrl: 'https://flags/td.svg' });
    expect(result.flagIconUrl).toBe('https://flags/td.svg');
    expect(result.parentInstanceId).toBe('africa');
  });
});
