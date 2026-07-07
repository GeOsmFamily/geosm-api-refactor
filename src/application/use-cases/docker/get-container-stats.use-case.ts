import { DockerService, ContainerStats } from '../../../infrastructure/docker/docker.service.js';

export class GetContainerStatsUseCase {
  constructor(private readonly dockerService: DockerService) {}

  async execute(id: string): Promise<ContainerStats> {
    return this.dockerService.getContainerStats(id);
  }
}
