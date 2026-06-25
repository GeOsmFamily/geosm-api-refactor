import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';

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
    return { layerId, name: layer.name, url };
  }
}
