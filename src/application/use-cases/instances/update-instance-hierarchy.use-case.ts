import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import type { Instance } from '../../../domain/entities/instance.entity.js';
import { InstanceKind } from '../../../domain/enums.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { InvalidHierarchyError } from '../../../domain/errors/invalid-hierarchy.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateInstanceHierarchyUseCase');

export interface UpdateInstanceHierarchyDTO {
  kind?: InstanceKind;
  parentInstanceId?: string | null;
  flagIconUrl?: string | null;
  /** Uniquement pour un CONTINENT ; les pays et regions heritent de leur parent. */
  continentCode?: string | null;
}

/** Type du parent exige pour chaque niveau (null = pas de parent possible). */
const REQUIRED_PARENT_KIND: Record<InstanceKind, InstanceKind | null> = {
  [InstanceKind.CONTINENT]: null,
  [InstanceKind.COUNTRY]: InstanceKind.CONTINENT,
  [InstanceKind.REGION]: InstanceKind.COUNTRY,
};

/**
 * Met a jour la place d'une instance dans l'arbre territorial (SUPER_ADMIN uniquement).
 *
 * Regles :
 *  - un continent n'a pas de parent ; un pays a un continent pour parent ; une region a un pays ;
 *  - un pays peut rester sans parent (instance anterieure a la hierarchie), pas une region ;
 *  - `continentCode` n'est saisi que sur un continent et recopie sur tous ses descendants.
 */
export class UpdateInstanceHierarchyUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(id: string, dto: UpdateInstanceHierarchyDTO): Promise<Instance> {
    const existing = await this.instanceRepository.findById(id);
    if (!existing) throw new NotFoundError('Instance', id);

    const kind = dto.kind ?? existing.kind;
    const parentId =
      dto.parentInstanceId !== undefined ? dto.parentInstanceId : existing.parentInstanceId;

    const parent = await this.resolveParent(id, kind, parentId);
    await this.assertChildrenStillValid(id, kind);

    const continentCode = this.resolveContinentCode(kind, parent, existing, dto);

    const updated = await this.instanceRepository.update(id, {
      kind,
      parentInstanceId: parentId,
      continentCode,
      ...(dto.flagIconUrl !== undefined ? { flagIconUrl: dto.flagIconUrl } : {}),
    });

    await this.propagateContinentCode(id, continentCode);
    logger.info('Instance hierarchy updated', { instanceId: id, kind, parentInstanceId: parentId });
    return updated;
  }

  private async resolveParent(
    id: string,
    kind: InstanceKind,
    parentId: string | null,
  ): Promise<Instance | null> {
    const required = REQUIRED_PARENT_KIND[kind];

    if (parentId === null) {
      if (kind === InstanceKind.REGION) {
        throw new InvalidHierarchyError('Une region doit etre rattachee a un pays', { kind });
      }
      return null;
    }
    if (required === null) {
      throw new InvalidHierarchyError('Un continent ne peut pas avoir de parent', { kind });
    }
    if (parentId === id) {
      throw new InvalidHierarchyError('Une instance ne peut pas etre son propre parent');
    }

    const parent = await this.instanceRepository.findById(parentId);
    if (!parent) throw new NotFoundError('Instance', parentId);
    if (parent.kind !== required) {
      throw new InvalidHierarchyError(
        kind === InstanceKind.COUNTRY
          ? "Un pays ne peut etre rattache qu'a un continent"
          : "Une region ne peut etre rattachee qu'a un pays",
        { kind, parentKind: parent.kind, requiredParentKind: required },
      );
    }
    return parent;
  }

  /** Changer le niveau d'un noeud ne doit pas rendre ses enfants incoherents. */
  private async assertChildrenStillValid(id: string, kind: InstanceKind): Promise<void> {
    const children = await this.instanceRepository.findChildren(id);
    const bad = children.filter((c) => REQUIRED_PARENT_KIND[c.kind] !== kind);
    if (bad.length > 0) {
      throw new InvalidHierarchyError('Cette instance a des enfants incompatibles avec ce niveau', {
        kind,
        incompatibleChildren: bad.map((c) => c.slug),
      });
    }
  }

  private resolveContinentCode(
    kind: InstanceKind,
    parent: Instance | null,
    existing: Instance,
    dto: UpdateInstanceHierarchyDTO,
  ): string | null {
    if (kind === InstanceKind.CONTINENT) {
      return dto.continentCode !== undefined ? dto.continentCode : existing.continentCode;
    }
    if (dto.continentCode !== undefined) {
      throw new InvalidHierarchyError(
        "Le code continent n'est modifiable que sur un continent ; il est herite du parent",
        { kind },
      );
    }
    return parent?.continentCode ?? null;
  }

  private async propagateContinentCode(id: string, continentCode: string | null): Promise<void> {
    const children = await this.instanceRepository.findChildren(id);
    for (const child of children) {
      if (child.continentCode !== continentCode) {
        await this.instanceRepository.update(child.id, { continentCode });
      }
      await this.propagateContinentCode(child.id, continentCode);
    }
  }
}
