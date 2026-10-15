import { asFunction, Lifetime } from 'awilix';
import type { IUserRepository } from '../domain/repositories/user.repository.js';
import { SetPreferredInstanceUseCase } from '../application/use-cases/users/set-preferred-instance.use-case.js';
import type { IInstanceRepository } from '../domain/repositories/instance.repository.js';
import { GetInstanceTreeUseCase } from '../application/use-cases/instances/get-instance-tree.use-case.js';
import { GetInstanceChildrenUseCase } from '../application/use-cases/instances/get-instance-children.use-case.js';
import { UpdateInstanceHierarchyUseCase } from '../application/use-cases/instances/update-instance-hierarchy.use-case.js';
import type { DomainRegistration } from './domain-registrations.js';

interface TerritoryCradle {
  instanceRepository: IInstanceRepository;
  userRepository: IUserRepository;
}

/** Domaine Territoire (chantier B) : arbre Monde > Continent > Pays > Region. */
export const territoryRegistrations: DomainRegistration = () => ({
  getInstanceTreeUseCase: asFunction(
    (c: TerritoryCradle) => new GetInstanceTreeUseCase(c.instanceRepository),
    { lifetime: Lifetime.SCOPED },
  ),
  getInstanceChildrenUseCase: asFunction(
    (c: TerritoryCradle) => new GetInstanceChildrenUseCase(c.instanceRepository),
    { lifetime: Lifetime.SCOPED },
  ),
  setPreferredInstanceUseCase: asFunction(
    (c: TerritoryCradle) => new SetPreferredInstanceUseCase(c.userRepository, c.instanceRepository),
    { lifetime: Lifetime.SCOPED },
  ),
  updateInstanceHierarchyUseCase: asFunction(
    (c: TerritoryCradle) => new UpdateInstanceHierarchyUseCase(c.instanceRepository),
    { lifetime: Lifetime.SCOPED },
  ),
});
