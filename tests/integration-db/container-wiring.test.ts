import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { setupContainer } from '../../src/container.js';
import { authPlugin } from '../../src/presentation/plugins/auth.plugin.js';

const DATABASE_URL = process.env.DATABASE_URL;
const shouldSkip = !DATABASE_URL;

/**
 * All keys from the Cradle interface in src/container.ts.
 * If a new key is added to the container, add it here to ensure it resolves.
 */
const CRADLE_KEYS = [
  // Infrastructure / services
  'prisma',
  'userRepository',
  'refreshTokenRepository',
  'instanceRepository',
  'groupRepository',
  'subGroupRepository',
  'layerRepository',
  'baseMapRepository',
  'layerStyleRepository',
  'exportRepository',
  'qgisProjectRepository',
  'defaultThemeRepository',
  'nominatimService',
  'osrmService',
  'meiliSearchService',
  'qgisServerService',
  'qgisProjectService',
  'passwordService',
  'emailService',
  'tokenService',
  'redisService',
  // Auth use cases
  'registerUseCase',
  'loginUseCase',
  'refreshTokenUseCase',
  'logoutUseCase',
  'verifyEmailUseCase',
  'forgotPasswordUseCase',
  'resetPasswordUseCase',
  'getProfileUseCase',
  'updateProfileUseCase',
  'changePasswordUseCase',
  // Users use cases
  'listUsersUseCase',
  'getUserUseCase',
  'createUserUseCase',
  'updateUserUseCase',
  'deleteUserUseCase',
  'changeUserRoleUseCase',
  'toggleUserActiveUseCase',
  // Instances use cases
  'listInstancesUseCase',
  'getInstanceUseCase',
  'createInstanceUseCase',
  'updateInstanceUseCase',
  'deleteInstanceUseCase',
  'getInstanceUsersUseCase',
  'addInstanceUserUseCase',
  'removeInstanceUserUseCase',
  'changeInstanceUserRoleUseCase',
  // Groups use cases
  'listGroupsUseCase',
  'getGroupUseCase',
  'createGroupUseCase',
  'updateGroupUseCase',
  'deleteGroupUseCase',
  'reorderGroupsUseCase',
  // SubGroups use cases
  'listSubGroupsUseCase',
  'getSubGroupUseCase',
  'createSubGroupUseCase',
  'updateSubGroupUseCase',
  'deleteSubGroupUseCase',
  // Layers use cases
  'listLayersUseCase',
  'getLayerUseCase',
  'createLayerUseCase',
  'updateLayerUseCase',
  'deleteLayerUseCase',
  // BaseMaps use cases
  'listBaseMapsUseCase',
  'createBaseMapUseCase',
  'updateBaseMapUseCase',
  'deleteBaseMapUseCase',
  // Styles use cases
  'getLayerStyleUseCase',
  'updateLayerStyleUseCase',
  'resetLayerStyleUseCase',
  'listDefaultStylesUseCase',
  // Exports use cases
  'createExportUseCase',
  'listExportsUseCase',
  'getExportUseCase',
  'deleteExportUseCase',
  // Geocoding use cases
  'searchGeocodingUseCase',
  'reverseGeocodingUseCase',
  'lookupGeocodingUseCase',
  // Routing use cases
  'calculateRouteUseCase',
  'findNearestUseCase',
  // Search use cases
  'globalSearchUseCase',
  'searchLayersUseCase',
  'searchFeaturesUseCase',
  // QGIS Projects use cases
  'getQgisProjectUseCase',
  'reloadQgisProjectUseCase',
  // Default Themes use cases
  'listDefaultThemesUseCase',
  'getDefaultThemeUseCase',
  'createDefaultThemeUseCase',
  'updateDefaultThemeUseCase',
  'deleteDefaultThemeUseCase',
  'getThemeTagsUseCase',
  'createThemeTagUseCase',
  'seedDefaultThemesUseCase',
  // Admin use cases
  'getDashboardUseCase',
  'listJobsUseCase',
  'getJobDetailsUseCase',
  'retryJobUseCase',
  'importOsmDataUseCase',
  'getSystemHealthUseCase',
  // OSM
  'osmQueryService',
  'osm2pgsqlService',
  'queryOsmUseCase',
  'createOsmTableUseCase',
  // Phase 4: Layer Import Pipeline
  'storageService',
  'queueService',
  'notificationService',
  'importLayerUseCase',
  'downloadExportUseCase',
  // Geospatial
  'postGISService',
  'ogr2ogrService',
  // Feature use cases
  'getFeaturesUseCase',
  'getFeatureUseCase',
  'addFeatureUseCase',
  'updateFeatureUseCase',
  'deleteFeatureUseCase',
  'getLayerStatsUseCase',
  // Search indexing
  'indexLayerUseCase',
  'removeLayerIndexUseCase',
  // Admin Boundary
  'findAdminBoundaryUseCase',
  // Drawings
  'drawingRepository',
  'saveDrawingUseCase',
  'getDrawingsUseCase',
  'getDrawingUseCase',
  'deleteDrawingUseCase',
  // Sharing
  'sharedMapRepository',
  'createSharedMapUseCase',
  'getSharedMapUseCase',
  // Analytics
  'analyticsRepository',
  'trackEventUseCase',
  'getAnalyticsUseCase',
  'incrementViewUseCase',
  // Catalog
  'getCatalogUseCase',
  // Map Compositions
  'mapCompositionRepository',
  'createMapCompositionUseCase',
  'getMapCompositionsUseCase',
  'getMapCompositionUseCase',
  'updateMapCompositionUseCase',
  'deleteMapCompositionUseCase',
  // Documents
  'documentRepository',
  'uploadDocumentUseCase',
  'listDocumentsUseCase',
  'getDocumentUseCase',
  'deleteDocumentUseCase',
  // IP Geolocation
  'geolocateIpUseCase',
  // SEO
  'getSeoMetadataUseCase',
  // Adressage
  'adressageService',
  'getAdresseUseCase',
  'getPositionUseCase',
  'getPointsUseCase',
  'searchAdresseUseCase',
  'getAdresseByClickUseCase',
  'codeUsageUseCase',
  // Spatial Analysis
  'spatialAnalysisUseCase',
  // Raster
  'rasterService',
  'uploadRasterUseCase',
  'downloadRasterUseCase',
  // SVG
  'svgGeneratorService',
  'generateIconUseCase',
  // Niche
  'saveCoordPdfUseCase',
  'configDbUseCase',
  'searchLimitInTableUseCase',
  'createInstanceTemplateUseCase',
  'getSourceFileUseCase',
  'manageSequenceUseCase',
] as const;

describe.skipIf(shouldSkip)('Container Wiring Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    // authPlugin is needed because JwtTokenService requires the Fastify JWT decorator
    await authPlugin(app);
    await setupContainer(app);
    await app.ready();
  }, 30_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should have a DI container registered', () => {
    expect(app.diContainer).toBeDefined();
  });

  it.each(CRADLE_KEYS.map((key) => [key]))('should resolve "%s" without error', (key) => {
    const resolved = app.diContainer.resolve(key as string);
    expect(resolved).not.toBeNull();
    expect(resolved).not.toBeUndefined();
  });

  it('should resolve all cradle keys (summary)', () => {
    const failures: string[] = [];
    for (const key of CRADLE_KEYS) {
      try {
        const resolved = app.diContainer.resolve(key as string);
        if (resolved == null) {
          failures.push(`${key}: resolved to ${resolved}`);
        }
      } catch (err) {
        failures.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
