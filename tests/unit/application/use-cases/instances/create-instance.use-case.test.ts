import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateInstanceUseCase } from '../../../../../src/application/use-cases/instances/create-instance.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import type { IGroupRepository } from '../../../../../src/domain/repositories/group.repository.js';
import type { ISubGroupRepository } from '../../../../../src/domain/repositories/sub-group.repository.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import type { OsmQueryService } from '../../../../../src/infrastructure/database/osm-query.service.js';
import type { IQgisProjectRepository } from '../../../../../src/domain/repositories/qgis-project.repository.js';
import type { IBaseMapRepository } from '../../../../../src/domain/repositories/base-map.repository.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';
import { Group } from '../../../../../src/domain/entities/group.entity.js';
import { SubGroup } from '../../../../../src/domain/entities/sub-group.entity.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';

describe('CreateInstanceUseCase', () => {
  let useCase: CreateInstanceUseCase;
  let instanceRepository: IInstanceRepository;
  let groupRepository: IGroupRepository;
  let subGroupRepository: ISubGroupRepository;
  let layerRepository: ILayerRepository;
  let osmQueryService: OsmQueryService;
  let qgisProjectRepository: IQgisProjectRepository;
  let baseMapRepository: IBaseMapRepository;
  const now = new Date();

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    groupRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findByInstance: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateOrder: vi.fn(),
    };
    subGroupRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findByGroup: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    };
    layerRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findBySubGroup: vi.fn(), findByInstance: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    };
    osmQueryService = {
      queryFeatures: vi.fn(), createTable: vi.fn(), getTableStats: vi.fn(),
    } as unknown as OsmQueryService;
    qgisProjectRepository = {
      findById: vi.fn(), findByInstance: vi.fn(),
      create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, createdAt: now, updatedAt: now })),
      update: vi.fn(), delete: vi.fn(),
    } as unknown as IQgisProjectRepository;
    baseMapRepository = {
      findById: vi.fn(), findByInstance: vi.fn(), findDefaults: vi.fn(),
      create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, createdAt: now, updatedAt: now })),
      update: vi.fn(), delete: vi.fn(),
    };

    const mockQgisProjectService = {
      getProjectPath: vi.fn().mockReturnValue('/projects/test/test.qgs'),
      ensureProjectDir: vi.fn().mockResolvedValue('/projects/test'),
      createProject: vi.fn().mockResolvedValue(undefined),
      addVectorLayer: vi.fn().mockResolvedValue(undefined),
      setupWmsCapabilities: vi.fn().mockResolvedValue(undefined),
    } as unknown as import('../../../../../src/infrastructure/qgis/qgis-project.service.js').QGISProjectService;

    const mockSvgGeneratorService = {
      generateSvg: vi.fn().mockReturnValue('<svg></svg>'),
      saveSvgToFile: vi.fn().mockResolvedValue(undefined),
    } as unknown as import('../../../../../src/infrastructure/utils/svg-generator.service.js').SvgGeneratorService;

    useCase = new CreateInstanceUseCase(
      instanceRepository,
      groupRepository,
      subGroupRepository,
      layerRepository,
      osmQueryService,
      mockQgisProjectService,
      mockSvgGeneratorService,
      qgisProjectRepository,
      baseMapRepository,
    );
  });

  it('should create instance successfully and trigger background default layer setup', async () => {
    vi.mocked(instanceRepository.findBySlug).mockResolvedValue(null);
    const created = new Instance({
      id: 'id',
      name: 'Test',
      slug: 'test',
      description: null,
      logo: null,
      bbox: [1, 2, 3, 4],
      centerLat: null,
      centerLon: null,
      defaultZoom: 6,
      isActive: true,
      boundaryTable: null,
      boundaryId: null,
      boundaryGeomCol: null,
      adminLevel: null,
      parentInstanceId: null,
      createdAt: now,
      updatedAt: now,
    });
    vi.mocked(instanceRepository.create).mockResolvedValue(created);

    const mockGroup = new Group({ id: 'grp-id', name: '{}', slug: 'test-grp', description: null, icon: 'icon', color: 'color', order: 1, isActive: true, instanceId: 'id', createdAt: now, updatedAt: now });
    vi.mocked(groupRepository.create).mockResolvedValue(mockGroup);

    const mockSubGroup = new SubGroup({ id: 'subgrp-id', name: '{}', slug: 'test-subgrp', description: null, icon: null, order: 1, isActive: true, groupId: 'grp-id', createdAt: now, updatedAt: now });
    vi.mocked(subGroupRepository.create).mockResolvedValue(mockSubGroup);

    const mockLayer = new Layer({
      id: 'lyr-id', name: '{}', slug: 'test-lyr', description: null, geometryType: GeometryType.POINT, sourceType: SourceType.WMS,
      sourceUrl: 'url', sourceLayer: 'layer', tableName: 'table', schemaName: 'schema', minZoom: 0, maxZoom: 22, isVisible: true, isQueryable: true,
      opacity: 1, order: 1, metadata: null, subGroupId: 'subgrp-id', instanceId: 'id', qgisProjectId: null, createdAt: now, updatedAt: now
    });
    vi.mocked(layerRepository.create).mockResolvedValue(mockLayer);
    vi.mocked(layerRepository.update).mockResolvedValue(mockLayer);

    vi.mocked(osmQueryService.createTable).mockResolvedValue({
      count: 10,
      totalArea: 5.5,
      totalLength: null,
      numPoints: 10
    });

    const result = await useCase.execute({ name: 'Test', slug: 'test', bbox: [1, 2, 3, 4] });
    expect(result.name).toBe('Test');
    expect(instanceRepository.create).toHaveBeenCalled();

    // Attendre un court instant pour s'assurer que les promesses en arrière-plan se résolvent dans le test
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(groupRepository.create).toHaveBeenCalled();
    expect(subGroupRepository.create).toHaveBeenCalled();
    expect(layerRepository.create).toHaveBeenCalled();
    expect(osmQueryService.createTable).toHaveBeenCalled();
  });

  it('should throw ConflictError if slug exists', async () => {
    const existing = new Instance({
      id: 'id',
      name: 'Test',
      slug: 'test',
      description: null,
      logo: null,
      bbox: null,
      centerLat: null,
      centerLon: null,
      defaultZoom: 6,
      isActive: true,
      boundaryTable: null,
      boundaryId: null,
      boundaryGeomCol: null,
      adminLevel: null,
      parentInstanceId: null,
      createdAt: now,
      updatedAt: now,
    });
    vi.mocked(instanceRepository.findBySlug).mockResolvedValue(existing);

    await expect(useCase.execute({ name: 'Test', slug: 'test' })).rejects.toThrow(ConflictError);
  });
});
