import { DockerService, ContainerSummary } from '../../../infrastructure/docker/docker.service.js';

export class ListContainersUseCase {
  constructor(private readonly dockerService: DockerService) {}

  async execute(): Promise<ContainerSummary[]> {
    return this.dockerService.listContainers();
  }
}
