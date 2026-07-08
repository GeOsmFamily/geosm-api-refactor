import Docker from 'dockerode';
import { createChildLogger } from '../observability/logger.js';

const logger = createChildLogger('DockerService');

export interface ContainerSummary {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
}

/**
 * Lot A8 admin (infra en lecture seule) - passe TOUJOURS par docker-socket-proxy (voir
 * docker-compose.yml), jamais par le socket Docker brut, même en lecture. Le proxy lui-même
 * refuse déjà toute action d'écriture (POST=0) - defense in depth, pas la seule protection.
 */
export class DockerService {
  private readonly docker: Docker;

  constructor() {
    this.docker = new Docker({ host: 'docker-socket-proxy', port: 2375 });
  }

  async listContainers(): Promise<ContainerSummary[]> {
    const containers = await this.docker.listContainers({ all: true });
    return containers.map((c) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') ?? c.Id.slice(0, 12),
      image: c.Image,
      state: c.State,
      status: c.Status,
    }));
  }

  async getContainerStats(id: string): Promise<ContainerStats> {
    const container = this.docker.getContainer(id);
    const stats = await container.stats({ stream: false });

    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuCount =
      stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0;

    const memoryUsage = stats.memory_stats.usage ?? 0;
    const memoryLimit = stats.memory_stats.limit ?? 1;

    return {
      cpuPercent: Math.round(cpuPercent * 10) / 10,
      memoryUsageMB: Math.round(memoryUsage / (1024 * 1024)),
      memoryLimitMB: Math.round(memoryLimit / (1024 * 1024)),
      memoryPercent: Math.round((memoryUsage / memoryLimit) * 1000) / 10,
    };
  }

  async getContainerLogs(id: string, tail = 200): Promise<string> {
    const container = this.docker.getContainer(id);
    const buffer = await container.logs({ stdout: true, stderr: true, tail, timestamps: true });
    // dockerode multiplexe stdout/stderr avec un en-tête binaire de 8 octets par frame quand le
    // conteneur n'a pas de TTY (cas général ici) - on retire cet en-tête pour ne garder que le
    // texte, sinon les logs contiennent des octets de contrôle illisibles.
    return this.demux(buffer as unknown as Buffer);
  }

  private demux(buffer: Buffer): string {
    const lines: string[] = [];
    let offset = 0;
    while (offset + 8 <= buffer.length) {
      const size = buffer.readUInt32BE(offset + 4);
      const start = offset + 8;
      const end = start + size;
      if (end > buffer.length) break;
      lines.push(buffer.subarray(start, end).toString('utf-8'));
      offset = end;
    }
    return lines.length > 0 ? lines.join('') : buffer.toString('utf-8');
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      logger.warn('Docker socket proxy unavailable', { error: (error as Error).message });
      return false;
    }
  }
}
