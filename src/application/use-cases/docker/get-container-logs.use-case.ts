import { DockerService } from '../../../infrastructure/docker/docker.service.js';

export class GetContainerLogsUseCase {
  constructor(private readonly dockerService: DockerService) {}

  async execute(id: string, tail?: number): Promise<{ logs: string }> {
    const logs = await this.dockerService.getContainerLogs(id, tail);
    return { logs };
  }
}
