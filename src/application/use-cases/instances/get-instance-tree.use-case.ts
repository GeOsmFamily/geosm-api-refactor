import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import type { Instance } from '../../../domain/entities/instance.entity.js';
import type { InstanceKind } from '../../../domain/enums.js';
import { withUseCaseSpan } from '../../../infrastructure/observability/social-telemetry.js';

export interface InstanceTreeNode {
  id: string;
  name: string;
  slug: string;
  kind: InstanceKind;
  description: string | null;
  flagIconUrl: string | null;
  continentCode: string | null;
  centerLat: number | null;
  centerLon: number | null;
  defaultZoom: number;
  isActive: boolean;
  children: InstanceTreeNode[];
}

/**
 * Arbre territorial Continent > Pays > Region, pour le selecteur d'onboarding.
 *
 * Toutes les instances sont retournees, actives ou non : un pays non actif reste visible dans
 * le selecteur (marque `isActive: false`). Une instance sans parent (ou dont le parent n'existe
 * plus) est une racine : c'est le cas d'un pays anterieur a la hierarchie, qui ne doit pas
 * disparaitre du selecteur.
 */
export class GetInstanceTreeUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(): Promise<InstanceTreeNode[]> {
    return withUseCaseSpan('GetInstanceTreeUseCase', {}, async () => {
      const all = await this.instanceRepository.findAllForTree();
      return buildTree(all);
    });
  }
}

export function buildTree(instances: Instance[]): InstanceTreeNode[] {
  const nodes = new Map<string, InstanceTreeNode>();
  for (const i of instances) nodes.set(i.id, toNode(i));

  const roots: InstanceTreeNode[] = [];
  for (const i of instances) {
    const node = nodes.get(i.id)!;
    const parent = i.parentInstanceId ? nodes.get(i.parentInstanceId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }

  const byName = (a: InstanceTreeNode, b: InstanceTreeNode) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  const sort = (list: InstanceTreeNode[]) => {
    list.sort(byName);
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

function toNode(i: Instance): InstanceTreeNode {
  return {
    id: i.id,
    name: i.name,
    slug: i.slug,
    kind: i.kind,
    description: i.description,
    flagIconUrl: i.flagIconUrl,
    continentCode: i.continentCode,
    centerLat: i.centerLat,
    centerLon: i.centerLon,
    defaultZoom: i.defaultZoom,
    isActive: i.isActive,
    children: [],
  };
}
