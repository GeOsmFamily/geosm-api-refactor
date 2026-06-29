import { PrismaClient } from '@prisma/client';
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, asValue, Lifetime } from 'awilix';
import type { FastifyInstance } from 'fastify';

import { PrismaUserRepository } from './infrastructure/database/repositories/prisma-user.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/database/repositories/prisma-refresh-token.repository.js';
import { PrismaInstanceRepository } from './infrastructure/database/repositories/prisma-instance.repository.js';
import { PrismaGroupRepository } from './infrastructure/database/repositories/prisma-group.repository.js';
import { PrismaSubGroupRepository } from './infrastructure/database/repositories/prisma-sub-group.repository.js';
import { PrismaLayerRepository } from './infrastructure/database/repositories/prisma-layer.repository.js';
import { PrismaBaseMapRepository } from './infrastructure/database/repositories/prisma-base-map.repository.js';
import { PrismaLayerStyleRepository } from './infrastructure/database/repositories/prisma-layer-style.repository.js';
import { PrismaExportRepository } from './infrastructure/database/repositories/prisma-export.repository.js';
import { PrismaQgisProjectRepository } from './infrastructure/database/repositories/prisma-qgis-project.repository.js';
import { PrismaDefaultThemeRepository } from './infrastructure/database/repositories/prisma-default-theme.repository.js';
import { Argon2PasswordService } from './infrastructure/auth/argon2-password.service.js';
import { JwtTokenService } from './infrastructure/auth/jwt-token.service.js';
import { RedisService } from './infrastructure/cache/redis.service.js';

// Auth use cases
import { RegisterUseCase } from './application/use-cases/auth/register.use-case.js';
import { LoginUseCase } from './application/use-cases/auth/login.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/auth/refresh-token.use-case.js';
import { LogoutUseCase } from './application/use-cases/auth/logout.use-case.js';
import { VerifyEmailUseCase } from './application/use-cases/auth/verify-email.use-case.js';
import { ForgotPasswordUseCase } from './application/use-cases/auth/forgot-password.use-case.js';
import { ResetPasswordUseCase } from './application/use-cases/auth/reset-password.use-case.js';
import { GetProfileUseCase } from './application/use-cases/auth/get-profile.use-case.js';
import { UpdateProfileUseCase } from './application/use-cases/auth/update-profile.use-case.js';
import { ChangePasswordUseCase } from './application/use-cases/auth/change-password.use-case.js';

// Users use cases
import { ListUsersUseCase } from './application/use-cases/users/list-users.use-case.js';
import { GetUserUseCase } from './application/use-cases/users/get-user.use-case.js';
import { CreateUserUseCase } from './application/use-cases/users/create-user.use-case.js';
import { UpdateUserUseCase } from './application/use-cases/users/update-user.use-case.js';
import { DeleteUserUseCase } from './application/use-cases/users/delete-user.use-case.js';
import { ChangeUserRoleUseCase } from './application/use-cases/users/change-user-role.use-case.js';
import { ToggleUserActiveUseCase } from './application/use-cases/users/toggle-user-active.use-case.js';

// Instances use cases
import { ListInstancesUseCase } from './application/use-cases/instances/list-instances.use-case.js';
import { GetInstanceUseCase } from './application/use-cases/instances/get-instance.use-case.js';
import { CreateInstanceUseCase } from './application/use-cases/instances/create-instance.use-case.js';
import { UpdateInstanceUseCase } from './application/use-cases/instances/update-instance.use-case.js';
import { DeleteInstanceUseCase } from './application/use-cases/instances/delete-instance.use-case.js';
import { GetInstanceUsersUseCase } from './application/use-cases/instances/get-instance-users.use-case.js';
import { AddInstanceUserUseCase } from './application/use-cases/instances/add-instance-user.use-case.js';
import { RemoveInstanceUserUseCase } from './application/use-cases/instances/remove-instance-user.use-case.js';
import { ChangeInstanceUserRoleUseCase } from './application/use-cases/instances/change-instance-user-role.use-case.js';

// Groups use cases
import { ListGroupsUseCase } from './application/use-cases/groups/list-groups.use-case.js';
import { GetGroupUseCase } from './application/use-cases/groups/get-group.use-case.js';
import { CreateGroupUseCase } from './application/use-cases/groups/create-group.use-case.js';
import { UpdateGroupUseCase } from './application/use-cases/groups/update-group.use-case.js';
import { DeleteGroupUseCase } from './application/use-cases/groups/delete-group.use-case.js';
import { ReorderGroupsUseCase } from './application/use-cases/groups/reorder-groups.use-case.js';

// SubGroups use cases
import { ListSubGroupsUseCase } from './application/use-cases/sub-groups/list-sub-groups.use-case.js';
import { GetSubGroupUseCase } from './application/use-cases/sub-groups/get-sub-group.use-case.js';
import { CreateSubGroupUseCase } from './application/use-cases/sub-groups/create-sub-group.use-case.js';
import { UpdateSubGroupUseCase } from './application/use-cases/sub-groups/update-sub-group.use-case.js';
import { DeleteSubGroupUseCase } from './application/use-cases/sub-groups/delete-sub-group.use-case.js';

// Layers use cases
import { ListLayersUseCase } from './application/use-cases/layers/list-layers.use-case.js';
import { GetLayerUseCase } from './application/use-cases/layers/get-layer.use-case.js';
import { CreateLayerUseCase } from './application/use-cases/layers/create-layer.use-case.js';
import { UpdateLayerUseCase } from './application/use-cases/layers/update-layer.use-case.js';
import { DeleteLayerUseCase } from './application/use-cases/layers/delete-layer.use-case.js';

// BaseMaps use cases
import { ListBaseMapsUseCase } from './application/use-cases/base-maps/list-base-maps.use-case.js';
import { CreateBaseMapUseCase } from './application/use-cases/base-maps/create-base-map.use-case.js';
import { UpdateBaseMapUseCase } from './application/use-cases/base-maps/update-base-map.use-case.js';
import { DeleteBaseMapUseCase } from './application/use-cases/base-maps/delete-base-map.use-case.js';

// External API services
import { NominatimService } from './infrastructure/external-apis/nominatim.service.js';
import { OSRMService } from './infrastructure/external-apis/osrm.service.js';
import { MeiliSearchService } from './infrastructure/external-apis/meilisearch.service.js';
import { QgisServerService } from './infrastructure/external-apis/qgis-server.service.js';
import { QGISProjectService } from './infrastructure/qgis/qgis-project.service.js';

// Styles use cases
import { GetLayerStyleUseCase } from './application/use-cases/styles/get-layer-style.use-case.js';
import { UpdateLayerStyleUseCase } from './application/use-cases/styles/update-layer-style.use-case.js';
import { ResetLayerStyleUseCase } from './application/use-cases/styles/reset-layer-style.use-case.js';
import { ListDefaultStylesUseCase } from './application/use-cases/styles/list-default-styles.use-case.js';

// Exports use cases
import { CreateExportUseCase } from './application/use-cases/exports/create-export.use-case.js';
import { ListExportsUseCase } from './application/use-cases/exports/list-exports.use-case.js';
import { GetExportUseCase } from './application/use-cases/exports/get-export.use-case.js';
import { DeleteExportUseCase } from './application/use-cases/exports/delete-export.use-case.js';

// Geocoding use cases
import { SearchGeocodingUseCase } from './application/use-cases/geocoding/search-geocoding.use-case.js';
import { ReverseGeocodingUseCase } from './application/use-cases/geocoding/reverse-geocoding.use-case.js';
import { LookupGeocodingUseCase } from './application/use-cases/geocoding/lookup-geocoding.use-case.js';

// Routing use cases
import { CalculateRouteUseCase } from './application/use-cases/routing/calculate-route.use-case.js';
import { FindNearestUseCase } from './application/use-cases/routing/find-nearest.use-case.js';

// Search use cases
import { GlobalSearchUseCase } from './application/use-cases/search/global-search.use-case.js';
import { SearchLayersUseCase } from './application/use-cases/search/search-layers.use-case.js';
import { SearchFeaturesUseCase } from './application/use-cases/search/search-features.use-case.js';
import { IndexLayerUseCase } from './application/use-cases/search/index-layer.use-case.js';
import { RemoveLayerIndexUseCase } from './application/use-cases/search/remove-layer-index.use-case.js';

// Admin Boundary use cases
import { FindAdminBoundaryUseCase } from './application/use-cases/geoportail/find-admin-boundary.use-case.js';

// Drawing use cases
import { PrismaDrawingRepository } from './infrastructure/database/repositories/prisma-drawing.repository.js';
import { SaveDrawingUseCase } from './application/use-cases/drawings/save-drawing.use-case.js';
import { GetDrawingsUseCase } from './application/use-cases/drawings/get-drawings.use-case.js';
import { GetDrawingUseCase } from './application/use-cases/drawings/get-drawing.use-case.js';
import { DeleteDrawingUseCase } from './application/use-cases/drawings/delete-drawing.use-case.js';

// Geosignet use cases
import { PrismaGeosignetRepository } from './infrastructure/database/repositories/prisma-geosignet.repository.js';
import { SaveGeosignetUseCase } from './application/use-cases/geosignets/save-geosignet.use-case.js';
import { GetGeosignetsUseCase } from './application/use-cases/geosignets/get-geosignets.use-case.js';
import { DeleteGeosignetUseCase } from './application/use-cases/geosignets/delete-geosignet.use-case.js';

// Comment use cases
import { PrismaCommentRepository } from './infrastructure/database/repositories/prisma-comment.repository.js';
import { SaveCommentUseCase } from './application/use-cases/comments/save-comment.use-case.js';
import { GetCommentsUseCase } from './application/use-cases/comments/get-comments.use-case.js';
import { DeleteCommentUseCase } from './application/use-cases/comments/delete-comment.use-case.js';

// Sharing use cases
import { PrismaSharedMapRepository } from './infrastructure/database/repositories/prisma-shared-map.repository.js';
import { CreateSharedMapUseCase } from './application/use-cases/sharing/create-shared-map.use-case.js';
import { GetSharedMapUseCase } from './application/use-cases/sharing/get-shared-map.use-case.js';

// Analytics use cases
import { PrismaAnalyticsRepository } from './infrastructure/database/repositories/prisma-analytics.repository.js';
import { TrackEventUseCase } from './application/use-cases/analytics/track-event.use-case.js';
import { GetAnalyticsUseCase } from './application/use-cases/analytics/get-analytics.use-case.js';

// QGIS Projects use cases
import { GetQgisProjectUseCase } from './application/use-cases/qgis-projects/get-qgis-project.use-case.js';
import { ReloadQgisProjectUseCase } from './application/use-cases/qgis-projects/reload-qgis-project.use-case.js';

// Default Themes use cases
import { ListDefaultThemesUseCase } from './application/use-cases/default-themes/list-default-themes.use-case.js';
import { GetDefaultThemeUseCase } from './application/use-cases/default-themes/get-default-theme.use-case.js';
import { CreateDefaultThemeUseCase } from './application/use-cases/default-themes/create-default-theme.use-case.js';
import { UpdateDefaultThemeUseCase } from './application/use-cases/default-themes/update-default-theme.use-case.js';
import { DeleteDefaultThemeUseCase } from './application/use-cases/default-themes/delete-default-theme.use-case.js';
import { GetThemeTagsUseCase } from './application/use-cases/default-themes/get-theme-tags.use-case.js';
import { CreateThemeTagUseCase } from './application/use-cases/default-themes/create-theme-tag.use-case.js';
import { SeedDefaultThemesUseCase } from './application/use-cases/default-themes/seed-default-themes.use-case.js';

// Admin use cases
import { GetDashboardUseCase } from './application/use-cases/admin/get-dashboard.use-case.js';
import { ListJobsUseCase } from './application/use-cases/admin/list-jobs.use-case.js';
import { GetSystemHealthUseCase } from './application/use-cases/admin/get-system-health.use-case.js';

// Adressage
import { AdressageService } from './infrastructure/database/adressage.service.js';
import { GetAdresseUseCase } from './application/use-cases/adressage/get-adresse.use-case.js';
import { GetPositionUseCase } from './application/use-cases/adressage/get-position.use-case.js';
import { GetPointsUseCase } from './application/use-cases/adressage/get-points.use-case.js';
import { SearchAdresseUseCase } from './application/use-cases/adressage/search-adresse.use-case.js';
import { GetAdresseByClickUseCase } from './application/use-cases/adressage/get-adresse-by-click.use-case.js';
import { CodeUsageUseCase } from './application/use-cases/adressage/code-usage.use-case.js';

// Spatial Analysis
import { SpatialAnalysisUseCase } from './application/use-cases/analysis/spatial-analysis.use-case.js';

// Raster
import { RasterService } from './infrastructure/gdal/raster.service.js';
import { UploadRasterUseCase } from './application/use-cases/rasters/upload-raster.use-case.js';
import { DownloadRasterUseCase } from './application/use-cases/rasters/download-raster.use-case.js';

// SVG Icons
import { SvgGeneratorService } from './infrastructure/utils/svg-generator.service.js';
import { GenerateIconUseCase } from './application/use-cases/admin/generate-icon.use-case.js';

// Niche use cases
import { SaveCoordPdfUseCase } from './application/use-cases/maps/save-coord-pdf.use-case.js';
import { ConfigDbUseCase } from './application/use-cases/admin/config-db.use-case.js';
import { SearchLimitInTableUseCase } from './application/use-cases/geoportail/search-limit-in-table.use-case.js';
import { CreateInstanceTemplateUseCase } from './application/use-cases/admin/create-instance-template.use-case.js';
import { GetSourceFileUseCase } from './application/use-cases/layers/get-source-file.use-case.js';
import { ManageSequenceUseCase } from './application/use-cases/admin/manage-sequence.use-case.js';

// Phase 4: Layer Import Pipeline
import { MinioStorageService } from './infrastructure/storage/minio.service.js';
import { QueueService } from './infrastructure/queue/queue.service.js';
import { NotificationService } from './infrastructure/websocket/notification.service.js';
import { ImportLayerUseCase } from './application/use-cases/layers/import-layer.use-case.js';
import { DownloadExportUseCase } from './application/use-cases/exports/download-export.use-case.js';

// Geospatial infrastructure
import { PostGISService } from './infrastructure/database/postgis.service.js';
import { Ogr2OgrService } from './infrastructure/gdal/ogr2ogr.service.js';

// Feature use cases
import { GetFeaturesUseCase } from './application/use-cases/features/get-features.use-case.js';
import { GetFeatureUseCase } from './application/use-cases/features/get-feature.use-case.js';
import { AddFeatureUseCase } from './application/use-cases/features/add-feature.use-case.js';
import { UpdateFeatureUseCase } from './application/use-cases/features/update-feature.use-case.js';
import { DeleteFeatureUseCase } from './application/use-cases/features/delete-feature.use-case.js';
import { GetLayerStatsUseCase } from './application/use-cases/layers/get-layer-stats.use-case.js';

import { SmtpEmailService } from './infrastructure/email/smtp.service.js';
import { OsmQueryService } from './infrastructure/database/osm-query.service.js';
import { Osm2pgsqlService } from './infrastructure/osm/osm2pgsql.service.js';

// OSM use cases
import { QueryOsmUseCase } from './application/use-cases/osm/query-osm.use-case.js';
import { CreateOsmTableUseCase } from './application/use-cases/osm/create-osm-table.use-case.js';

// Catalog use cases
import { GetCatalogUseCase } from './application/use-cases/catalog/get-catalog.use-case.js';

// Map Composition use cases
import { PrismaMapCompositionRepository } from './infrastructure/database/repositories/prisma-map-composition.repository.js';
import { CreateMapCompositionUseCase } from './application/use-cases/maps/create-map-composition.use-case.js';
import { GetMapCompositionsUseCase } from './application/use-cases/maps/get-map-compositions.use-case.js';
import { GetMapCompositionUseCase } from './application/use-cases/maps/get-map-composition.use-case.js';
import { UpdateMapCompositionUseCase } from './application/use-cases/maps/update-map-composition.use-case.js';
import { DeleteMapCompositionUseCase } from './application/use-cases/maps/delete-map-composition.use-case.js';

// View counter use case
import { IncrementViewUseCase } from './application/use-cases/analytics/increment-view.use-case.js';

// Document use cases
import { PrismaDocumentRepository } from './infrastructure/database/repositories/prisma-document.repository.js';
import { UploadDocumentUseCase } from './application/use-cases/documents/upload-document.use-case.js';
import { ListDocumentsUseCase } from './application/use-cases/documents/list-documents.use-case.js';
import { GetDocumentUseCase } from './application/use-cases/documents/get-document.use-case.js';
import { DeleteDocumentUseCase } from './application/use-cases/documents/delete-document.use-case.js';

// IP Geolocation use case
import { GeolocateIpUseCase } from './application/use-cases/geoportail/geolocate-ip.use-case.js';

// SEO use case
import { GetSeoMetadataUseCase } from './application/use-cases/seo/get-seo-metadata.use-case.js';

// Additional admin use cases
import { GetJobDetailsUseCase } from './application/use-cases/admin/get-job-details.use-case.js';
import { RetryJobUseCase } from './application/use-cases/admin/retry-job.use-case.js';
import { ImportOsmDataUseCase } from './application/use-cases/admin/import-osm-data.use-case.js';

interface Cradle {
  prisma: PrismaClient;
  userRepository: PrismaUserRepository;
  refreshTokenRepository: PrismaRefreshTokenRepository;
  instanceRepository: PrismaInstanceRepository;
  groupRepository: PrismaGroupRepository;
  subGroupRepository: PrismaSubGroupRepository;
  layerRepository: PrismaLayerRepository;
  baseMapRepository: PrismaBaseMapRepository;
  layerStyleRepository: PrismaLayerStyleRepository;
  exportRepository: PrismaExportRepository;
  qgisProjectRepository: PrismaQgisProjectRepository;
  defaultThemeRepository: PrismaDefaultThemeRepository;
  nominatimService: NominatimService;
  osrmService: OSRMService;
  meiliSearchService: MeiliSearchService;
  qgisServerService: QgisServerService;
  qgisProjectService: QGISProjectService;
  passwordService: Argon2PasswordService;
  emailService: SmtpEmailService;
  tokenService: JwtTokenService;
  redisService: RedisService;
  // Auth
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
  logoutUseCase: LogoutUseCase;
  verifyEmailUseCase: VerifyEmailUseCase;
  forgotPasswordUseCase: ForgotPasswordUseCase;
  resetPasswordUseCase: ResetPasswordUseCase;
  getProfileUseCase: GetProfileUseCase;
  updateProfileUseCase: UpdateProfileUseCase;
  changePasswordUseCase: ChangePasswordUseCase;
  // Users
  listUsersUseCase: ListUsersUseCase;
  getUserUseCase: GetUserUseCase;
  createUserUseCase: CreateUserUseCase;
  updateUserUseCase: UpdateUserUseCase;
  deleteUserUseCase: DeleteUserUseCase;
  changeUserRoleUseCase: ChangeUserRoleUseCase;
  toggleUserActiveUseCase: ToggleUserActiveUseCase;
  // Instances
  listInstancesUseCase: ListInstancesUseCase;
  getInstanceUseCase: GetInstanceUseCase;
  createInstanceUseCase: CreateInstanceUseCase;
  updateInstanceUseCase: UpdateInstanceUseCase;
  deleteInstanceUseCase: DeleteInstanceUseCase;
  getInstanceUsersUseCase: GetInstanceUsersUseCase;
  addInstanceUserUseCase: AddInstanceUserUseCase;
  removeInstanceUserUseCase: RemoveInstanceUserUseCase;
  changeInstanceUserRoleUseCase: ChangeInstanceUserRoleUseCase;
  // Groups
  listGroupsUseCase: ListGroupsUseCase;
  getGroupUseCase: GetGroupUseCase;
  createGroupUseCase: CreateGroupUseCase;
  updateGroupUseCase: UpdateGroupUseCase;
  deleteGroupUseCase: DeleteGroupUseCase;
  reorderGroupsUseCase: ReorderGroupsUseCase;
  // SubGroups
  listSubGroupsUseCase: ListSubGroupsUseCase;
  getSubGroupUseCase: GetSubGroupUseCase;
  createSubGroupUseCase: CreateSubGroupUseCase;
  updateSubGroupUseCase: UpdateSubGroupUseCase;
  deleteSubGroupUseCase: DeleteSubGroupUseCase;
  // Layers
  listLayersUseCase: ListLayersUseCase;
  getLayerUseCase: GetLayerUseCase;
  createLayerUseCase: CreateLayerUseCase;
  updateLayerUseCase: UpdateLayerUseCase;
  deleteLayerUseCase: DeleteLayerUseCase;
  // BaseMaps
  listBaseMapsUseCase: ListBaseMapsUseCase;
  createBaseMapUseCase: CreateBaseMapUseCase;
  updateBaseMapUseCase: UpdateBaseMapUseCase;
  deleteBaseMapUseCase: DeleteBaseMapUseCase;
  // Styles
  getLayerStyleUseCase: GetLayerStyleUseCase;
  updateLayerStyleUseCase: UpdateLayerStyleUseCase;
  resetLayerStyleUseCase: ResetLayerStyleUseCase;
  listDefaultStylesUseCase: ListDefaultStylesUseCase;
  // Exports
  createExportUseCase: CreateExportUseCase;
  listExportsUseCase: ListExportsUseCase;
  getExportUseCase: GetExportUseCase;
  deleteExportUseCase: DeleteExportUseCase;
  // Geocoding
  searchGeocodingUseCase: SearchGeocodingUseCase;
  reverseGeocodingUseCase: ReverseGeocodingUseCase;
  lookupGeocodingUseCase: LookupGeocodingUseCase;
  // Routing
  calculateRouteUseCase: CalculateRouteUseCase;
  findNearestUseCase: FindNearestUseCase;
  // Search
  globalSearchUseCase: GlobalSearchUseCase;
  searchLayersUseCase: SearchLayersUseCase;
  searchFeaturesUseCase: SearchFeaturesUseCase;
  // QGIS Projects
  getQgisProjectUseCase: GetQgisProjectUseCase;
  reloadQgisProjectUseCase: ReloadQgisProjectUseCase;
  // Default Themes
  listDefaultThemesUseCase: ListDefaultThemesUseCase;
  getDefaultThemeUseCase: GetDefaultThemeUseCase;
  createDefaultThemeUseCase: CreateDefaultThemeUseCase;
  updateDefaultThemeUseCase: UpdateDefaultThemeUseCase;
  deleteDefaultThemeUseCase: DeleteDefaultThemeUseCase;
  getThemeTagsUseCase: GetThemeTagsUseCase;
  createThemeTagUseCase: CreateThemeTagUseCase;
  seedDefaultThemesUseCase: SeedDefaultThemesUseCase;
  // Admin
  getDashboardUseCase: GetDashboardUseCase;
  listJobsUseCase: ListJobsUseCase;
  getJobDetailsUseCase: GetJobDetailsUseCase;
  retryJobUseCase: RetryJobUseCase;
  importOsmDataUseCase: ImportOsmDataUseCase;
  getSystemHealthUseCase: GetSystemHealthUseCase;
  // OSM
  osmQueryService: OsmQueryService;
  osm2pgsqlService: Osm2pgsqlService;
  queryOsmUseCase: QueryOsmUseCase;
  createOsmTableUseCase: CreateOsmTableUseCase;
  // Phase 4: Layer Import Pipeline
  storageService: MinioStorageService;
  queueService: QueueService;
  notificationService: NotificationService;
  importLayerUseCase: ImportLayerUseCase;
  downloadExportUseCase: DownloadExportUseCase;
  // Geospatial
  postGISService: PostGISService;
  ogr2ogrService: Ogr2OgrService;
  // Feature use cases
  getFeaturesUseCase: GetFeaturesUseCase;
  getFeatureUseCase: GetFeatureUseCase;
  addFeatureUseCase: AddFeatureUseCase;
  updateFeatureUseCase: UpdateFeatureUseCase;
  deleteFeatureUseCase: DeleteFeatureUseCase;
  getLayerStatsUseCase: GetLayerStatsUseCase;
  // Search indexing
  indexLayerUseCase: IndexLayerUseCase;
  removeLayerIndexUseCase: RemoveLayerIndexUseCase;
  // Admin Boundary
  findAdminBoundaryUseCase: FindAdminBoundaryUseCase;
  // Drawings
  drawingRepository: PrismaDrawingRepository;
  saveDrawingUseCase: SaveDrawingUseCase;
  getDrawingsUseCase: GetDrawingsUseCase;
  getDrawingUseCase: GetDrawingUseCase;
  deleteDrawingUseCase: DeleteDrawingUseCase;
  // Geosignets
  geosignetRepository: PrismaGeosignetRepository;
  saveGeosignetUseCase: SaveGeosignetUseCase;
  getGeosignetsUseCase: GetGeosignetsUseCase;
  deleteGeosignetUseCase: DeleteGeosignetUseCase;
  // Comments
  commentRepository: PrismaCommentRepository;
  saveCommentUseCase: SaveCommentUseCase;
  getCommentsUseCase: GetCommentsUseCase;
  deleteCommentUseCase: DeleteCommentUseCase;
  // Sharing
  sharedMapRepository: PrismaSharedMapRepository;
  createSharedMapUseCase: CreateSharedMapUseCase;
  getSharedMapUseCase: GetSharedMapUseCase;
  // Analytics
  analyticsRepository: PrismaAnalyticsRepository;
  trackEventUseCase: TrackEventUseCase;
  getAnalyticsUseCase: GetAnalyticsUseCase;
  incrementViewUseCase: IncrementViewUseCase;
  // Catalog
  getCatalogUseCase: GetCatalogUseCase;
  // Map Compositions
  mapCompositionRepository: PrismaMapCompositionRepository;
  createMapCompositionUseCase: CreateMapCompositionUseCase;
  getMapCompositionsUseCase: GetMapCompositionsUseCase;
  getMapCompositionUseCase: GetMapCompositionUseCase;
  updateMapCompositionUseCase: UpdateMapCompositionUseCase;
  deleteMapCompositionUseCase: DeleteMapCompositionUseCase;
  // Documents
  documentRepository: PrismaDocumentRepository;
  uploadDocumentUseCase: UploadDocumentUseCase;
  listDocumentsUseCase: ListDocumentsUseCase;
  getDocumentUseCase: GetDocumentUseCase;
  deleteDocumentUseCase: DeleteDocumentUseCase;
  // IP Geolocation
  geolocateIpUseCase: GeolocateIpUseCase;
  // SEO
  getSeoMetadataUseCase: GetSeoMetadataUseCase;
  // Adressage
  adressageService: AdressageService;
  getAdresseUseCase: GetAdresseUseCase;
  getPositionUseCase: GetPositionUseCase;
  getPointsUseCase: GetPointsUseCase;
  searchAdresseUseCase: SearchAdresseUseCase;
  getAdresseByClickUseCase: GetAdresseByClickUseCase;
  codeUsageUseCase: CodeUsageUseCase;
  // Spatial Analysis
  spatialAnalysisUseCase: SpatialAnalysisUseCase;
  // Raster
  rasterService: RasterService;
  uploadRasterUseCase: UploadRasterUseCase;
  downloadRasterUseCase: DownloadRasterUseCase;
  // SVG
  svgGeneratorService: SvgGeneratorService;
  generateIconUseCase: GenerateIconUseCase;
  // Niche
  saveCoordPdfUseCase: SaveCoordPdfUseCase;
  configDbUseCase: ConfigDbUseCase;
  searchLimitInTableUseCase: SearchLimitInTableUseCase;
  createInstanceTemplateUseCase: CreateInstanceTemplateUseCase;
  getSourceFileUseCase: GetSourceFileUseCase;
  manageSequenceUseCase: ManageSequenceUseCase;
}

export async function setupContainer(app: FastifyInstance): Promise<void> {
  const prisma = new PrismaClient();
  await prisma.$connect();

  await app.register(fastifyAwilixPlugin, {
    disposeOnClose: true,
    disposeOnResponse: false,
    strictBooleanEnforced: true,
  });

  const tokenService = new JwtTokenService(app);

  diContainer.register({
    prisma: asValue(prisma),
    tokenService: asValue(tokenService),

    redisService: asFunction(() => new RedisService(), { lifetime: Lifetime.SINGLETON }),
    passwordService: asFunction(() => new Argon2PasswordService(), { lifetime: Lifetime.SINGLETON }),
    emailService: asFunction(() => new SmtpEmailService(), { lifetime: Lifetime.SINGLETON }),

    // Repositories
    userRepository: asFunction(() => new PrismaUserRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    refreshTokenRepository: asFunction(() => new PrismaRefreshTokenRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    instanceRepository: asFunction(() => new PrismaInstanceRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    groupRepository: asFunction(() => new PrismaGroupRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    subGroupRepository: asFunction(() => new PrismaSubGroupRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    layerRepository: asFunction(() => new PrismaLayerRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    baseMapRepository: asFunction(() => new PrismaBaseMapRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    layerStyleRepository: asFunction(() => new PrismaLayerStyleRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    exportRepository: asFunction(() => new PrismaExportRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    qgisProjectRepository: asFunction(() => new PrismaQgisProjectRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    defaultThemeRepository: asFunction(() => new PrismaDefaultThemeRepository(prisma), { lifetime: Lifetime.SINGLETON }),

    // External API services
    nominatimService: asFunction(() => new NominatimService(), { lifetime: Lifetime.SINGLETON }),
    osrmService: asFunction(() => new OSRMService(), { lifetime: Lifetime.SINGLETON }),
    meiliSearchService: asFunction(() => new MeiliSearchService(), { lifetime: Lifetime.SINGLETON }),
    qgisServerService: asFunction(() => new QgisServerService(), { lifetime: Lifetime.SINGLETON }),
    qgisProjectService: asFunction(() => new QGISProjectService(), { lifetime: Lifetime.SINGLETON }),

    // Auth use cases
    registerUseCase: asFunction((c: Cradle) =>
      new RegisterUseCase(c.userRepository, c.passwordService, c.emailService),
    { lifetime: Lifetime.SCOPED }),

    loginUseCase: asFunction((c: Cradle) =>
      new LoginUseCase(c.userRepository, c.refreshTokenRepository, c.passwordService, c.tokenService),
    { lifetime: Lifetime.SCOPED }),

    refreshTokenUseCase: asFunction((c: Cradle) =>
      new RefreshTokenUseCase(c.userRepository, c.refreshTokenRepository, c.tokenService),
    { lifetime: Lifetime.SCOPED }),

    logoutUseCase: asFunction((c: Cradle) =>
      new LogoutUseCase(c.refreshTokenRepository),
    { lifetime: Lifetime.SCOPED }),

    verifyEmailUseCase: asFunction((c: Cradle) =>
      new VerifyEmailUseCase(c.userRepository),
    { lifetime: Lifetime.SCOPED }),

    forgotPasswordUseCase: asFunction((c: Cradle) =>
      new ForgotPasswordUseCase(c.userRepository, c.emailService),
    { lifetime: Lifetime.SCOPED }),

    resetPasswordUseCase: asFunction((c: Cradle) =>
      new ResetPasswordUseCase(c.userRepository, c.passwordService, c.refreshTokenRepository),
    { lifetime: Lifetime.SCOPED }),

    getProfileUseCase: asFunction((c: Cradle) =>
      new GetProfileUseCase(c.userRepository),
    { lifetime: Lifetime.SCOPED }),

    updateProfileUseCase: asFunction((c: Cradle) =>
      new UpdateProfileUseCase(c.userRepository),
    { lifetime: Lifetime.SCOPED }),

    changePasswordUseCase: asFunction((c: Cradle) =>
      new ChangePasswordUseCase(c.userRepository, c.passwordService, c.refreshTokenRepository),
    { lifetime: Lifetime.SCOPED }),

    // Users use cases
    listUsersUseCase: asFunction((c: Cradle) => new ListUsersUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    getUserUseCase: asFunction((c: Cradle) => new GetUserUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    createUserUseCase: asFunction((c: Cradle) => new CreateUserUseCase(c.userRepository, c.passwordService), { lifetime: Lifetime.SCOPED }),
    updateUserUseCase: asFunction((c: Cradle) => new UpdateUserUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    deleteUserUseCase: asFunction((c: Cradle) => new DeleteUserUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    changeUserRoleUseCase: asFunction((c: Cradle) => new ChangeUserRoleUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    toggleUserActiveUseCase: asFunction((c: Cradle) => new ToggleUserActiveUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),

    // Instances use cases
    listInstancesUseCase: asFunction((c: Cradle) => new ListInstancesUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    getInstanceUseCase: asFunction((c: Cradle) => new GetInstanceUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    createInstanceUseCase: asFunction((c: Cradle) => new CreateInstanceUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    updateInstanceUseCase: asFunction((c: Cradle) => new UpdateInstanceUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    deleteInstanceUseCase: asFunction((c: Cradle) => new DeleteInstanceUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    getInstanceUsersUseCase: asFunction((c: Cradle) => new GetInstanceUsersUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    addInstanceUserUseCase: asFunction((c: Cradle) => new AddInstanceUserUseCase(c.instanceRepository, c.userRepository), { lifetime: Lifetime.SCOPED }),
    removeInstanceUserUseCase: asFunction((c: Cradle) => new RemoveInstanceUserUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    changeInstanceUserRoleUseCase: asFunction((c: Cradle) => new ChangeInstanceUserRoleUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),

    // Groups use cases
    listGroupsUseCase: asFunction((c: Cradle) => new ListGroupsUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),
    getGroupUseCase: asFunction((c: Cradle) => new GetGroupUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),
    createGroupUseCase: asFunction((c: Cradle) => new CreateGroupUseCase(c.groupRepository, c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    updateGroupUseCase: asFunction((c: Cradle) => new UpdateGroupUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),
    deleteGroupUseCase: asFunction((c: Cradle) => new DeleteGroupUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),
    reorderGroupsUseCase: asFunction((c: Cradle) => new ReorderGroupsUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),

    // SubGroups use cases
    listSubGroupsUseCase: asFunction((c: Cradle) => new ListSubGroupsUseCase(c.subGroupRepository), { lifetime: Lifetime.SCOPED }),
    getSubGroupUseCase: asFunction((c: Cradle) => new GetSubGroupUseCase(c.subGroupRepository), { lifetime: Lifetime.SCOPED }),
    createSubGroupUseCase: asFunction((c: Cradle) => new CreateSubGroupUseCase(c.subGroupRepository, c.groupRepository), { lifetime: Lifetime.SCOPED }),
    updateSubGroupUseCase: asFunction((c: Cradle) => new UpdateSubGroupUseCase(c.subGroupRepository), { lifetime: Lifetime.SCOPED }),
    deleteSubGroupUseCase: asFunction((c: Cradle) => new DeleteSubGroupUseCase(c.subGroupRepository), { lifetime: Lifetime.SCOPED }),

    // Layers use cases
    listLayersUseCase: asFunction((c: Cradle) => new ListLayersUseCase(c.layerRepository), { lifetime: Lifetime.SCOPED }),
    getLayerUseCase: asFunction((c: Cradle) => new GetLayerUseCase(c.layerRepository), { lifetime: Lifetime.SCOPED }),
    createLayerUseCase: asFunction((c: Cradle) => new CreateLayerUseCase(c.layerRepository, c.instanceRepository, c.indexLayerUseCase), { lifetime: Lifetime.SCOPED }),
    updateLayerUseCase: asFunction((c: Cradle) => new UpdateLayerUseCase(c.layerRepository, c.indexLayerUseCase), { lifetime: Lifetime.SCOPED }),
    deleteLayerUseCase: asFunction((c: Cradle) => new DeleteLayerUseCase(c.layerRepository, c.removeLayerIndexUseCase), { lifetime: Lifetime.SCOPED }),

    // BaseMaps use cases
    listBaseMapsUseCase: asFunction((c: Cradle) => new ListBaseMapsUseCase(c.baseMapRepository), { lifetime: Lifetime.SCOPED }),
    createBaseMapUseCase: asFunction((c: Cradle) => new CreateBaseMapUseCase(c.baseMapRepository, c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    updateBaseMapUseCase: asFunction((c: Cradle) => new UpdateBaseMapUseCase(c.baseMapRepository), { lifetime: Lifetime.SCOPED }),
    deleteBaseMapUseCase: asFunction((c: Cradle) => new DeleteBaseMapUseCase(c.baseMapRepository), { lifetime: Lifetime.SCOPED }),

    // Styles use cases
    getLayerStyleUseCase: asFunction((c: Cradle) => new GetLayerStyleUseCase(c.layerStyleRepository), { lifetime: Lifetime.SCOPED }),
    updateLayerStyleUseCase: asFunction((c: Cradle) => new UpdateLayerStyleUseCase(c.layerStyleRepository), { lifetime: Lifetime.SCOPED }),
    resetLayerStyleUseCase: asFunction((c: Cradle) => new ResetLayerStyleUseCase(c.layerStyleRepository), { lifetime: Lifetime.SCOPED }),
    listDefaultStylesUseCase: asFunction((c: Cradle) => new ListDefaultStylesUseCase(c.prisma), { lifetime: Lifetime.SCOPED }),

    // Exports use cases
    createExportUseCase: asFunction((c: Cradle) => new CreateExportUseCase(c.exportRepository, c.queueService), { lifetime: Lifetime.SCOPED }),
    listExportsUseCase: asFunction((c: Cradle) => new ListExportsUseCase(c.exportRepository), { lifetime: Lifetime.SCOPED }),
    getExportUseCase: asFunction((c: Cradle) => new GetExportUseCase(c.exportRepository), { lifetime: Lifetime.SCOPED }),
    deleteExportUseCase: asFunction((c: Cradle) => new DeleteExportUseCase(c.exportRepository), { lifetime: Lifetime.SCOPED }),

    // Geocoding use cases
    searchGeocodingUseCase: asFunction((c: Cradle) => new SearchGeocodingUseCase(c.nominatimService), { lifetime: Lifetime.SCOPED }),
    reverseGeocodingUseCase: asFunction((c: Cradle) => new ReverseGeocodingUseCase(c.nominatimService), { lifetime: Lifetime.SCOPED }),
    lookupGeocodingUseCase: asFunction((c: Cradle) => new LookupGeocodingUseCase(c.nominatimService), { lifetime: Lifetime.SCOPED }),

    // Routing use cases
    calculateRouteUseCase: asFunction((c: Cradle) => new CalculateRouteUseCase(c.osrmService), { lifetime: Lifetime.SCOPED }),
    findNearestUseCase: asFunction((c: Cradle) => new FindNearestUseCase(c.osrmService), { lifetime: Lifetime.SCOPED }),

    // Search use cases
    globalSearchUseCase: asFunction((c: Cradle) => new GlobalSearchUseCase(c.meiliSearchService), { lifetime: Lifetime.SCOPED }),
    searchLayersUseCase: asFunction((c: Cradle) => new SearchLayersUseCase(c.meiliSearchService), { lifetime: Lifetime.SCOPED }),
    searchFeaturesUseCase: asFunction((c: Cradle) => new SearchFeaturesUseCase(c.meiliSearchService), { lifetime: Lifetime.SCOPED }),

    // QGIS Projects use cases
    getQgisProjectUseCase: asFunction((c: Cradle) => new GetQgisProjectUseCase(c.qgisProjectRepository), { lifetime: Lifetime.SCOPED }),
    reloadQgisProjectUseCase: asFunction((c: Cradle) => new ReloadQgisProjectUseCase(c.qgisProjectRepository), { lifetime: Lifetime.SCOPED }),

    // Default Themes use cases
    listDefaultThemesUseCase: asFunction((c: Cradle) => new ListDefaultThemesUseCase(c.defaultThemeRepository), { lifetime: Lifetime.SCOPED }),
    getDefaultThemeUseCase: asFunction((c: Cradle) => new GetDefaultThemeUseCase(c.defaultThemeRepository), { lifetime: Lifetime.SCOPED }),
    createDefaultThemeUseCase: asFunction((c: Cradle) => new CreateDefaultThemeUseCase(c.defaultThemeRepository), { lifetime: Lifetime.SCOPED }),
    updateDefaultThemeUseCase: asFunction((c: Cradle) => new UpdateDefaultThemeUseCase(c.defaultThemeRepository), { lifetime: Lifetime.SCOPED }),
    deleteDefaultThemeUseCase: asFunction((c: Cradle) => new DeleteDefaultThemeUseCase(c.defaultThemeRepository), { lifetime: Lifetime.SCOPED }),
    getThemeTagsUseCase: asFunction((c: Cradle) => new GetThemeTagsUseCase(c.defaultThemeRepository), { lifetime: Lifetime.SCOPED }),
    createThemeTagUseCase: asFunction((c: Cradle) => new CreateThemeTagUseCase(c.defaultThemeRepository), { lifetime: Lifetime.SCOPED }),
    seedDefaultThemesUseCase: asFunction((c: Cradle) => new SeedDefaultThemesUseCase(c.defaultThemeRepository), { lifetime: Lifetime.SCOPED }),

    // Admin use cases
    getDashboardUseCase: asFunction((c: Cradle) => new GetDashboardUseCase(c.instanceRepository, c.userRepository, c.exportRepository, c.defaultThemeRepository), { lifetime: Lifetime.SCOPED }),
    listJobsUseCase: asFunction((c: Cradle) => new ListJobsUseCase(c.queueService), { lifetime: Lifetime.SCOPED }),
    getJobDetailsUseCase: asFunction((c: Cradle) => new GetJobDetailsUseCase(c.queueService), { lifetime: Lifetime.SCOPED }),
    retryJobUseCase: asFunction((c: Cradle) => new RetryJobUseCase(c.queueService), { lifetime: Lifetime.SCOPED }),
    importOsmDataUseCase: asFunction((c: Cradle) => new ImportOsmDataUseCase(c.osm2pgsqlService), { lifetime: Lifetime.SCOPED }),
    getSystemHealthUseCase: asFunction((c: Cradle) => new GetSystemHealthUseCase(c.prisma, c.redisService), { lifetime: Lifetime.SCOPED }),

    // Phase 4: Layer Import Pipeline
    storageService: asFunction(() => new MinioStorageService(), { lifetime: Lifetime.SINGLETON }),
    queueService: asFunction(() => new QueueService(), { lifetime: Lifetime.SINGLETON }),
    notificationService: asFunction(() => new NotificationService(), { lifetime: Lifetime.SINGLETON }),

    importLayerUseCase: asFunction((c: Cradle) => new ImportLayerUseCase(c.layerRepository, c.exportRepository, c.storageService, c.queueService), { lifetime: Lifetime.SCOPED }),
    downloadExportUseCase: asFunction((c: Cradle) => new DownloadExportUseCase(c.exportRepository, c.storageService), { lifetime: Lifetime.SCOPED }),

    // Geospatial services
    postGISService: asFunction(() => new PostGISService(prisma), { lifetime: Lifetime.SINGLETON }),
    ogr2ogrService: asFunction(() => new Ogr2OgrService(), { lifetime: Lifetime.SINGLETON }),

    // OSM services
    osmQueryService: asFunction(() => new OsmQueryService(prisma), { lifetime: Lifetime.SINGLETON }),
    osm2pgsqlService: asFunction(() => new Osm2pgsqlService(), { lifetime: Lifetime.SINGLETON }),
    queryOsmUseCase: asFunction((c: Cradle) => new QueryOsmUseCase(c.osmQueryService), { lifetime: Lifetime.SCOPED }),
    createOsmTableUseCase: asFunction((c: Cradle) => new CreateOsmTableUseCase(c.osmQueryService), { lifetime: Lifetime.SCOPED }),

    // Feature use cases
    getFeaturesUseCase: asFunction((c: Cradle) => new GetFeaturesUseCase(c.layerRepository, c.postGISService), { lifetime: Lifetime.SCOPED }),
    getFeatureUseCase: asFunction((c: Cradle) => new GetFeatureUseCase(c.layerRepository, c.postGISService), { lifetime: Lifetime.SCOPED }),
    addFeatureUseCase: asFunction((c: Cradle) => new AddFeatureUseCase(c.layerRepository, c.postGISService), { lifetime: Lifetime.SCOPED }),
    updateFeatureUseCase: asFunction((c: Cradle) => new UpdateFeatureUseCase(c.layerRepository, c.postGISService), { lifetime: Lifetime.SCOPED }),
    deleteFeatureUseCase: asFunction((c: Cradle) => new DeleteFeatureUseCase(c.layerRepository, c.postGISService), { lifetime: Lifetime.SCOPED }),
    getLayerStatsUseCase: asFunction((c: Cradle) => new GetLayerStatsUseCase(c.layerRepository, c.postGISService), { lifetime: Lifetime.SCOPED }),

    // Search indexing use cases
    indexLayerUseCase: asFunction((c: Cradle) => new IndexLayerUseCase(c.meiliSearchService), { lifetime: Lifetime.SCOPED }),
    removeLayerIndexUseCase: asFunction((c: Cradle) => new RemoveLayerIndexUseCase(c.meiliSearchService), { lifetime: Lifetime.SCOPED }),

    // Admin Boundary
    findAdminBoundaryUseCase: asFunction((c: Cradle) => new FindAdminBoundaryUseCase(c.prisma), { lifetime: Lifetime.SCOPED }),

    // Drawing repositories and use cases
    drawingRepository: asFunction(() => new PrismaDrawingRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    saveDrawingUseCase: asFunction((c: Cradle) => new SaveDrawingUseCase(c.drawingRepository), { lifetime: Lifetime.SCOPED }),
    getDrawingsUseCase: asFunction((c: Cradle) => new GetDrawingsUseCase(c.drawingRepository), { lifetime: Lifetime.SCOPED }),
    getDrawingUseCase: asFunction((c: Cradle) => new GetDrawingUseCase(c.drawingRepository), { lifetime: Lifetime.SCOPED }),
    deleteDrawingUseCase: asFunction((c: Cradle) => new DeleteDrawingUseCase(c.drawingRepository), { lifetime: Lifetime.SCOPED }),

    // Geosignet repositories and use cases
    geosignetRepository: asFunction(() => new PrismaGeosignetRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    saveGeosignetUseCase: asFunction((c: Cradle) => new SaveGeosignetUseCase(c.geosignetRepository), { lifetime: Lifetime.SCOPED }),
    getGeosignetsUseCase: asFunction((c: Cradle) => new GetGeosignetsUseCase(c.geosignetRepository), { lifetime: Lifetime.SCOPED }),
    deleteGeosignetUseCase: asFunction((c: Cradle) => new DeleteGeosignetUseCase(c.geosignetRepository), { lifetime: Lifetime.SCOPED }),

    // Comment repositories and use cases
    commentRepository: asFunction(() => new PrismaCommentRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    saveCommentUseCase: asFunction((c: Cradle) => new SaveCommentUseCase(c.commentRepository), { lifetime: Lifetime.SCOPED }),
    getCommentsUseCase: asFunction((c: Cradle) => new GetCommentsUseCase(c.commentRepository), { lifetime: Lifetime.SCOPED }),
    deleteCommentUseCase: asFunction((c: Cradle) => new DeleteCommentUseCase(c.commentRepository), { lifetime: Lifetime.SCOPED }),

    // Sharing repositories and use cases
    sharedMapRepository: asFunction(() => new PrismaSharedMapRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    createSharedMapUseCase: asFunction((c: Cradle) => new CreateSharedMapUseCase(c.sharedMapRepository), { lifetime: Lifetime.SCOPED }),
    getSharedMapUseCase: asFunction((c: Cradle) => new GetSharedMapUseCase(c.sharedMapRepository), { lifetime: Lifetime.SCOPED }),

    // Analytics repositories and use cases
    analyticsRepository: asFunction(() => new PrismaAnalyticsRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    trackEventUseCase: asFunction((c: Cradle) => new TrackEventUseCase(c.analyticsRepository), { lifetime: Lifetime.SCOPED }),
    getAnalyticsUseCase: asFunction((c: Cradle) => new GetAnalyticsUseCase(c.analyticsRepository), { lifetime: Lifetime.SCOPED }),
    incrementViewUseCase: asFunction((c: Cradle) => new IncrementViewUseCase(c.analyticsRepository), { lifetime: Lifetime.SCOPED }),

    // Catalog
    getCatalogUseCase: asFunction((c: Cradle) => new GetCatalogUseCase(c.prisma), { lifetime: Lifetime.SCOPED }),

    // Map Composition repositories and use cases
    mapCompositionRepository: asFunction(() => new PrismaMapCompositionRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    createMapCompositionUseCase: asFunction((c: Cradle) => new CreateMapCompositionUseCase(c.mapCompositionRepository), { lifetime: Lifetime.SCOPED }),
    getMapCompositionsUseCase: asFunction((c: Cradle) => new GetMapCompositionsUseCase(c.mapCompositionRepository), { lifetime: Lifetime.SCOPED }),
    getMapCompositionUseCase: asFunction((c: Cradle) => new GetMapCompositionUseCase(c.mapCompositionRepository), { lifetime: Lifetime.SCOPED }),
    updateMapCompositionUseCase: asFunction((c: Cradle) => new UpdateMapCompositionUseCase(c.mapCompositionRepository), { lifetime: Lifetime.SCOPED }),
    deleteMapCompositionUseCase: asFunction((c: Cradle) => new DeleteMapCompositionUseCase(c.mapCompositionRepository), { lifetime: Lifetime.SCOPED }),

    // Document repositories and use cases
    documentRepository: asFunction(() => new PrismaDocumentRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    uploadDocumentUseCase: asFunction((c: Cradle) => new UploadDocumentUseCase(c.documentRepository, c.storageService), { lifetime: Lifetime.SCOPED }),
    listDocumentsUseCase: asFunction((c: Cradle) => new ListDocumentsUseCase(c.documentRepository), { lifetime: Lifetime.SCOPED }),
    getDocumentUseCase: asFunction((c: Cradle) => new GetDocumentUseCase(c.documentRepository), { lifetime: Lifetime.SCOPED }),
    deleteDocumentUseCase: asFunction((c: Cradle) => new DeleteDocumentUseCase(c.documentRepository, c.storageService), { lifetime: Lifetime.SCOPED }),

    // IP Geolocation
    geolocateIpUseCase: asFunction(() => new GeolocateIpUseCase(), { lifetime: Lifetime.SCOPED }),

    // SEO
    getSeoMetadataUseCase: asFunction((c: Cradle) => new GetSeoMetadataUseCase(c.prisma), { lifetime: Lifetime.SCOPED }),

    // Adressage
    adressageService: asFunction(() => new AdressageService(prisma), { lifetime: Lifetime.SINGLETON }),
    getAdresseUseCase: asFunction((c: Cradle) => new GetAdresseUseCase(c.adressageService), { lifetime: Lifetime.SCOPED }),
    getPositionUseCase: asFunction((c: Cradle) => new GetPositionUseCase(c.adressageService), { lifetime: Lifetime.SCOPED }),
    getPointsUseCase: asFunction((c: Cradle) => new GetPointsUseCase(c.adressageService), { lifetime: Lifetime.SCOPED }),
    searchAdresseUseCase: asFunction((c: Cradle) => new SearchAdresseUseCase(c.adressageService), { lifetime: Lifetime.SCOPED }),
    getAdresseByClickUseCase: asFunction((c: Cradle) => new GetAdresseByClickUseCase(c.adressageService), { lifetime: Lifetime.SCOPED }),
    codeUsageUseCase: asFunction((c: Cradle) => new CodeUsageUseCase(c.adressageService), { lifetime: Lifetime.SCOPED }),

    // Spatial Analysis
    spatialAnalysisUseCase: asFunction(() => new SpatialAnalysisUseCase(prisma), { lifetime: Lifetime.SCOPED }),

    // Raster
    rasterService: asFunction(() => new RasterService(), { lifetime: Lifetime.SINGLETON }),
    uploadRasterUseCase: asFunction((c: Cradle) => new UploadRasterUseCase(c.rasterService, c.storageService), { lifetime: Lifetime.SCOPED }),
    downloadRasterUseCase: asFunction((c: Cradle) => new DownloadRasterUseCase(c.rasterService), { lifetime: Lifetime.SCOPED }),

    // SVG
    svgGeneratorService: asFunction(() => new SvgGeneratorService(), { lifetime: Lifetime.SINGLETON }),
    generateIconUseCase: asFunction((c: Cradle) => new GenerateIconUseCase(c.svgGeneratorService), { lifetime: Lifetime.SCOPED }),

    // Niche
    saveCoordPdfUseCase: asFunction(() => new SaveCoordPdfUseCase(prisma), { lifetime: Lifetime.SCOPED }),
    configDbUseCase: asFunction(() => new ConfigDbUseCase(), { lifetime: Lifetime.SCOPED }),
    searchLimitInTableUseCase: asFunction(() => new SearchLimitInTableUseCase(prisma), { lifetime: Lifetime.SCOPED }),
    createInstanceTemplateUseCase: asFunction((c: Cradle) => new CreateInstanceTemplateUseCase(c.instanceRepository, prisma), { lifetime: Lifetime.SCOPED }),
    getSourceFileUseCase: asFunction((c: Cradle) => new GetSourceFileUseCase(c.layerRepository, c.storageService), { lifetime: Lifetime.SCOPED }),
    manageSequenceUseCase: asFunction(() => new ManageSequenceUseCase(prisma), { lifetime: Lifetime.SCOPED }),
  });
}
