import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetSourceFileUseCase');

export class GetSourceFileUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly storageService: MinioStorageService,
  ) {}

  async execute(layerId: string) {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new Error('Layer not found');

    const objectName = `layers/${layerId}/source`;
    const url = await this.storageService.getPresignedUrl(objectName);
    logger.info('Source file presigned URL generated', { layerId });
    return { layerId, name: layer.name, url };
  }
}
