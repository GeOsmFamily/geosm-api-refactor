import { v4 as uuidv4 } from 'uuid';
import { IBaseMapRepository } from '../../../domain/repositories/base-map.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { CreateBaseMapDTO } from '../../dtos/base-map.dto.js';
import { BaseMap } from '../../../domain/entities/base-map.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateBaseMapUseCase');

export class CreateBaseMapUseCase {
  constructor(
    private readonly baseMapRepository: IBaseMapRepository,
    private readonly instanceRepository: IInstanceRepository,
  ) {}

  async execute(instanceId: string, dto: CreateBaseMapDTO): Promise<BaseMap> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);

    const slug = Slug.create(dto.slug);

    const baseMap = await this.baseMapRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      type: dto.type,
      url: dto.url,
      thumbnail: dto.thumbnail ?? null,
      attribution: dto.attribution ?? null,
      isDefault: dto.isDefault ?? false,
      order: dto.order ?? 0,
      config: dto.config ?? null,
      instanceId,
    });
    logger.info('Base map created', { instanceId, baseMapId: baseMap.id });
    return baseMap;
  }
}
