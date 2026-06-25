# GeOSM v3.0 - System Architecture Document

## Overview

GeOSM (Geographic Open Source Mapping) v3.0 is an open-source geoportail platform designed for managing, visualizing, and sharing geographic data, with a primary focus on African countries. It provides a complete GIS infrastructure that enables organizations to create multi-instance geoportails with data sourced from OpenStreetMap, user uploads (GeoJSON, Shapefile, GeoPackage, KML), and raster imagery.

The platform supports the full lifecycle of geographic data: import, storage, styling, visualization (via WMS/WFS), feature editing, spatial analysis, export, and sharing.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                           │
│  Routes ─ Middleware ─ Schemas (Zod) ─ Plugins ─ WebSocket       │
├──────────────────────────────────────────────────────────────────┤
│                     APPLICATION LAYER                            │
│  Use Cases (Auth, Users, Instances, Groups, Layers, Features,    │
│  Exports, Search, OSM, Drawings, Sharing, Analytics, Catalog,    │
│  Maps, Documents, Geocoding, Routing, QGIS, Admin, Adressage,   │
│  Analysis, Rasters, SEO, Geoportail, Styles, Default Themes)     │
├──────────────────────────────────────────────────────────────────┤
│                       DOMAIN LAYER                               │
│  Entities ─ Enums ─ Errors ─ Repository Interfaces               │
├──────────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE LAYER                           │
│  Prisma/PostGIS ─ BullMQ ─ MinIO ─ MeiliSearch ─ Redis          │
│  QGIS Server ─ GDAL/OGR ─ Nominatim ─ OSRM ─ SMTP ─ osm2pgsql │
└──────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Node.js | 22.x |
| Language | TypeScript | ^5.7.0 |
| Framework | Fastify | ^5.0.0 |
| ORM | Prisma Client | ^6.0.0 |
| Database | PostgreSQL + PostGIS | 16 + 3.4 |
| Cache/Queue Backend | Redis | 7 (Alpine) |
| Job Queue | BullMQ | ^5.0.0 |
| Object Storage | MinIO | 2024-01 |
| Search Engine | MeiliSearch | v1.6 |
| Map Server | QGIS Server | 3.28 |
| Auth | @fastify/jwt (RS256) + Argon2 | ^9.0.0 / ^0.41.0 |
| Validation | Zod | ^3.0.0 |
| DI Container | Awilix + @fastify/awilix | ^12.0.0 / ^6.0.0 |
| File Upload | @fastify/multipart | ^9.0.0 |
| WebSocket | @fastify/websocket | ^11.0.0 |
| Logging | Winston | ^3.0.0 |
| Metrics | prom-client (Prometheus) | ^15.0.0 |
| API Docs | @fastify/swagger + swagger-ui | ^9.0.0 / ^5.0.0 |
| Security | @fastify/helmet, @fastify/rate-limit, @fastify/cors | ^13.0.0 / ^10.0.0 / ^11.0.0 |
| Email | Nodemailer | ^9.0.1 |
| Geospatial Tools | GDAL/ogr2ogr, osm2pgsql | System |
| External APIs | Nominatim (geocoding), OSRM (routing) | Self-hosted |
| Testing | Vitest | ^3.0.0 |
| Build | tsx (dev), tsc (build) | ^4.0.0 |

## System Architecture Diagram

```
                         ┌──────────┐
                         │ Frontend │
                         │ (SPA)    │
                         └────┬─────┘
                              │ HTTP / WebSocket
                              ▼
                    ┌─────────────────────┐
                    │   GeOSM API         │
                    │   (Fastify 5)       │
                    │   Port 3000         │
                    ├─────────────────────┤
                    │ BullMQ Workers      │
                    │ (in-process)        │
                    └──┬──┬──┬──┬──┬──┬──┘
                       │  │  │  │  │  │
        ┌──────────────┘  │  │  │  │  └──────────────────┐
        ▼                 │  │  │  │                      ▼
┌───────────────┐         │  │  │  │          ┌──────────────────┐
│ PostgreSQL    │         │  │  │  │          │ QGIS Server      │
│ + PostGIS     │◄────────┘  │  │  │          │ Port 8380        │
│ Port 5432     │            │  │  └────┐     │ (WMS/WFS)        │
│               │            │  │       │     └──────┬───────────┘
│ - Prisma      │            │  │       │            │
│   models      │            ▼  │       ▼            │ reads .qgs
│ - Spatial     │     ┌─────────┤  ┌──────────┐      │ projects
│   tables      │     │ Redis   │  │ MinIO    │      │
│ - OSM tables  │     │ 7       │  │ (S3)     │  ┌───▼───────────┐
│   (planet_    │     │ Port    │  │ Port     │  │ QGIS Project  │
│    osm_*)     │     │ 6379    │  │ 9000     │  │ Files (.qgs)  │
└───────────────┘     └─────────┘  └──────────┘  └───────────────┘
                           │
                      ┌────┴────┐
                      │BullMQ   │
                      │Queues:  │
                      │ layer-  │
                      │ import  │
                      │ layer-  │
                      │ export  │
                      └─────────┘

                    External Services
        ┌───────────┐  ┌──────────┐  ┌──────────────┐
        │ Nominatim │  │ OSRM     │  │ MeiliSearch  │
        │ Geocoding │  │ Routing  │  │ Full-text    │
        │ Port 8081 │  │ Port 5000│  │ Port 7700    │
        └───────────┘  └──────────┘  └──────────────┘
```

## Clean Architecture Layers

### Presentation Layer

Located in `src/presentation/`:

- **Routes** (31 route modules): Define HTTP endpoints, request validation, and response serialization
- **Middleware**:
  - `error-handler.middleware.ts` - Global error handler
  - `request-logger.middleware.ts` - Request/response logging
  - `metrics.middleware.ts` - Prometheus metrics collection
- **Plugins**:
  - `auth.plugin.ts` - JWT authentication decorator
  - `cors.plugin.ts` - CORS configuration
  - `swagger.plugin.ts` - OpenAPI documentation
  - `websocket.plugin.ts` - WebSocket support
  - `multipart.plugin.ts` - File upload handling
- **Schemas**: Zod schemas for request/response validation (co-located with routes)

### Application Layer

Located in `src/application/use-cases/`. Contains 90+ use cases organized by domain:

| Category | Use Cases | Count |
|----------|-----------|-------|
| Auth | Register, Login, RefreshToken, Logout, VerifyEmail, ForgotPassword, ResetPassword, GetProfile, UpdateProfile, ChangePassword | 10 |
| Users | ListUsers, GetUser, CreateUser, UpdateUser, DeleteUser, ChangeUserRole, ToggleUserActive | 7 |
| Instances | ListInstances, GetInstance, CreateInstance, UpdateInstance, DeleteInstance, GetInstanceUsers, AddInstanceUser, RemoveInstanceUser, ChangeInstanceUserRole | 9 |
| Groups | ListGroups, GetGroup, CreateGroup, UpdateGroup, DeleteGroup, ReorderGroups | 6 |
| SubGroups | ListSubGroups, GetSubGroup, CreateSubGroup, UpdateSubGroup, DeleteSubGroup | 5 |
| Layers | ListLayers, GetLayer, CreateLayer, UpdateLayer, DeleteLayer, ImportLayer, GetSourceFile, GetLayerStats | 8 |
| Features | GetFeatures, GetFeature, AddFeature, UpdateFeature, DeleteFeature | 5 |
| Base Maps | ListBaseMaps, CreateBaseMap, UpdateBaseMap, DeleteBaseMap | 4 |
| Styles | GetLayerStyle, UpdateLayerStyle, ResetLayerStyle, ListDefaultStyles | 4 |
| Exports | CreateExport, ListExports, GetExport, DeleteExport, DownloadExport | 5 |
| Geocoding | SearchGeocoding, ReverseGeocoding, LookupGeocoding | 3 |
| Routing | CalculateRoute, FindNearest | 2 |
| Search | GlobalSearch, SearchLayers, SearchFeatures, IndexLayer, RemoveLayerIndex | 5 |
| OSM | QueryOsm, CreateOsmTable | 2 |
| QGIS Projects | GetQgisProject, ReloadQgisProject | 2 |
| Default Themes | ListDefaultThemes, GetDefaultTheme, CreateDefaultTheme, UpdateDefaultTheme, DeleteDefaultTheme, GetThemeTags, CreateThemeTag, SeedDefaultThemes | 8 |
| Admin | GetDashboard, ListJobs, GetJobDetails, RetryJob, ImportOsmData, GetSystemHealth, GenerateIcon, ConfigDb, CreateInstanceTemplate, ManageSequence | 10 |
| Drawings | SaveDrawing, GetDrawings, GetDrawing, DeleteDrawing | 4 |
| Sharing | CreateSharedMap, GetSharedMap | 2 |
| Analytics | TrackEvent, GetAnalytics, IncrementView | 3 |
| Catalog | GetCatalog | 1 |
| Maps | CreateMapComposition, GetMapCompositions, GetMapComposition, UpdateMapComposition, DeleteMapComposition, SaveCoordPdf | 6 |
| Documents | UploadDocument, ListDocuments, GetDocument, DeleteDocument | 4 |
| Geoportail | FindAdminBoundary, GeolocateIp, SearchLimitInTable | 3 |
| SEO | GetSeoMetadata | 1 |
| Adressage | GetAdresse, GetPosition, GetPoints, SearchAdresse, GetAdresseByClick, CodeUsage | 6 |
| Analysis | SpatialAnalysis | 1 |
| Rasters | UploadRaster, DownloadRaster | 2 |

### Domain Layer

Located in `src/domain/`:

- **Entities**: User, Instance, InstanceUser, Group, SubGroup, Layer, LayerStyle, LayerAction, BaseMap, Export, QgisProject, DefaultTheme, DefaultTag, Drawing, SharedMap, AnalyticsEvent, MapComposition, Document, RefreshToken
- **Enums**: Role (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR, VIEWER), GeometryType, SourceType, ActionType, ExportFormat, JobStatus, BaseMapType
- **Errors**: Domain-specific error classes
- **Repository Interfaces**: Contracts for data access

### Infrastructure Layer

Located in `src/infrastructure/`:

| Service | Implementation | Purpose |
|---------|---------------|---------|
| Database | Prisma + raw SQL | ORM for 19 models, raw queries for PostGIS |
| PostGIS | `postgis.service.ts` | Spatial SQL operations (ST_GeomFromGeoJSON, etc.) |
| OSM Query | `osm-query.service.ts` | Query planet_osm_* tables |
| osm2pgsql | `osm2pgsql.service.ts` | Import PBF files into PostGIS |
| Queue | BullMQ via `queue.service.ts` | Async job processing (layer-import, layer-export) |
| Storage | MinIO via `minio.service.ts` | Object storage for uploads/exports |
| Cache | Redis via `redis.service.ts` | Caching, queue backend |
| Search | MeiliSearch via `meilisearch.service.ts` | Full-text search indexing |
| QGIS | `qgis-project.service.ts` + `qgis-server.service.ts` | Project management, WMS/WFS proxy |
| GDAL | `ogr2ogr.service.ts` + `raster.service.ts` | Format conversion, raster processing |
| Email | SMTP via `smtp.service.ts` | Transactional emails |
| Auth | `argon2-password.service.ts` + `jwt-token.service.ts` | Password hashing, JWT tokens |
| Geocoding | Nominatim via `nominatim.service.ts` | Address search |
| Routing | OSRM via `osrm.service.ts` | Route calculation |
| WebSocket | `notification.service.ts` | Real-time notifications |
| Observability | Winston logger + prom-client | Logging and metrics |
| Adressage | `adressage.service.ts` | Address/geo-coding service |
| SVG | `svg-generator.service.ts` | Icon generation |

## Database Architecture

### Prisma Models (19 models)

```
┌──────────┐     ┌──────────────┐     ┌─────────┐
│   User   │────<│ RefreshToken │     │Instance │
│          │     └──────────────┘     │         │
│          │────<┌──────────────┐────>│         │
│          │     │ InstanceUser │     │         │
└────┬─────┘     └──────────────┘     └────┬────┘
     │                                     │
     │  ┌────────┐                    ┌────┴────┐
     └─<│ Export  │───>┌───────┐ <────│  Group  │
        └────────┘    │ Layer │      └────┬────┘
                      │       │           │
     ┌────────────┐──>│       │<──┌───────┴───┐
     │ QgisProject│   │       │   │  SubGroup │
     └────────────┘   └───┬───┘   └───────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌──────────┐ ┌───────────┐
        │LayerStyle│ │LayerAction│ │  Export   │
        └──────────┘ └──────────┘ └───────────┘

┌──────────┐  ┌──────────┐  ┌────────────────┐
│ BaseMap  │  │ Drawing  │  │ AnalyticsEvent │
└──────────┘  └──────────┘  └────────────────┘

┌───────────┐  ┌────────────────┐  ┌──────────┐
│ SharedMap │  │MapComposition  │  │ Document │
└───────────┘  └────────────────┘  └──────────┘

┌──────────────┐     ┌────────────┐
│ DefaultTheme │────<│ DefaultTag │
└──────────────┘     └────────────┘
```

### Key Relationships

- **User** has many: RefreshTokens, Exports, InstanceUsers
- **Instance** has many: Groups, Layers, BaseMaps, QgisProjects, InstanceUsers
- **Group** belongs to Instance, has many SubGroups
- **SubGroup** belongs to Group, has many Layers
- **Layer** belongs to SubGroup + Instance + QgisProject(optional), has many LayerStyles, LayerActions, Exports
- **DefaultTheme** has many DefaultTags

### PostGIS Spatial Tables (Dynamic)

When a layer is created from data import, a dedicated PostGIS table is created with:
- `gid` (serial primary key)
- `geom` (geometry column, SRID 4326)
- Dynamic attribute columns from the source data

Referenced by `Layer.tableName` and `Layer.schemaName`.

### OSM Tables

Created by osm2pgsql from PBF imports:
- `planet_osm_point` - Point features (amenities, shops, etc.)
- `planet_osm_line` - Linear features (roads, rivers, etc.)
- `planet_osm_polygon` - Area features (buildings, land use, etc.)
- `planet_osm_roads` - Road-specific features (subset optimized for rendering)

## Authentication and Authorization

### JWT RS256 Flow

1. **Registration**: User registers with email/password. Password hashed with Argon2id (memory: 64MB, iterations: 3, parallelism: 4)
2. **Login**: Verify credentials, issue JWT access token (15m) + refresh token (7d)
3. **Access**: Bearer token in Authorization header, verified per-request
4. **Refresh**: When access token expires, use refresh token to get new pair (token rotation with family tracking)
5. **Logout**: Revoke all tokens in the refresh token family

### RBAC Matrix

| Action | SUPER_ADMIN | ADMIN_INSTANCE | EDITOR | VIEWER |
|--------|:-----------:|:--------------:|:------:|:------:|
| Manage users (global) | Yes | - | - | - |
| Create instances | Yes | - | - | - |
| Delete instances | Yes | - | - | - |
| Update instance | Yes | Yes (own) | - | - |
| Manage instance users | Yes | Yes (own) | - | - |
| Create/edit groups | Yes | Yes (own) | - | - |
| Create/edit sub-groups | Yes | Yes (own) | - | - |
| Create/edit layers | Yes | Yes (own) | Yes | - |
| Create/edit features | Yes | Yes (own) | Yes | - |
| Import layer data | Yes | Yes (own) | Yes | - |
| Update styles | Yes | Yes (own) | Yes | - |
| View layers/features | Yes | Yes | Yes | Yes |
| Export data | Yes | Yes | Yes | Yes |
| Admin dashboard/jobs | Yes | - | - | - |
| OSM import | Yes | - | - | - |
| Manage default themes | Yes | - | - | - |
| Create base maps | Yes | Yes (own) | - | - |
| Manage QGIS projects | Yes | Yes (own) | - | - |
| Upload rasters | Yes | Yes (own) | - | - |

## Multi-Instance Architecture

Each **Instance** represents a geographic deployment (typically a country or region):

- **Data Isolation**: Groups, SubGroups, Layers, BaseMaps, and QgisProjects are scoped to an instance
- **User Assignment**: Users are assigned to instances via `InstanceUser` with per-instance roles
- **Configuration**: Each instance has its own bbox, center coordinates, default zoom, logo
- **QGIS Projects**: Separate .qgs project files per instance for WMS/WFS serving
- **Slug-based Routing**: Instances identified by unique slugs (e.g., `cameroon`, `senegal`)

### Instance Roles

A user can have different roles across instances. The `InstanceUser` model stores `userId + instanceId + role`, with a unique constraint on `(userId, instanceId)`.

## API Endpoints Summary

### Health & Monitoring (4 endpoints)
- `GET /health`, `GET /health/ready`, `GET /health/live`, `GET /metrics`

### Authentication (10 endpoints)
- `POST /api/v1/auth/register|login|refresh|logout|verify-email|forgot-password|reset-password`
- `GET|PATCH /api/v1/auth/me`, `PUT /api/v1/auth/me/password`

### Users (7 endpoints)
- CRUD + role change + activate/deactivate at `/api/v1/users`

### Instances (9 endpoints)
- CRUD at `/api/v1/instances` + user management at `/:instanceId/users`

### Groups (6 endpoints)
- CRUD + reorder at `/api/v1/instances/:instanceId/groups`

### Sub-Groups (5 endpoints)
- CRUD at `/api/v1/groups/:groupId/sub-groups`

### Layers (6 endpoints)
- CRUD + source file at `/api/v1/instances/:instanceId/layers`

### Features (5 endpoints)
- CRUD at `/api/v1/layers/:layerId/features`

### Base Maps (4 endpoints)
- CRUD at `/api/v1/instances/:instanceId/base-maps`

### Styles (5 endpoints)
- Get/update SLD/Mapbox/reset/defaults at `/api/v1/layers/:layerId/style`

### Exports (5 endpoints)
- Create/list/get/download/delete at `/api/v1/exports`

### Layer Import (2 endpoints)
- Import + download at `/api/v1/layers`

### Geocoding (3 endpoints)
- Search/reverse/lookup at `/api/v1/geocode`

### Routing (2 endpoints)
- Route/nearest at `/api/v1/routing`

### Search (3 endpoints)
- Global/layers/features at `/api/v1/search`

### QGIS Projects (2 endpoints)
- Get/reload at `/api/v1/instances/:instanceId/qgis-project`

### WMS/WFS Proxy (2 endpoints)
- `GET /api/v1/wms`, `GET /api/v1/wfs`

### Default Themes (8 endpoints)
- CRUD + tags + seed at `/api/v1/default-themes`

### Admin (13 endpoints)
- Dashboard, jobs, OSM import, cache, icons, config, templates, sequences at `/api/v1/admin`

### OSM (2 endpoints)
- Query/create-table at `/api/v1/osm`

### Geoportail (7 endpoints)
- Altitude, elevation, admin boundary, geolocate, stats, search-limit, save-coord at `/api/v1/geoportail`

### Drawings (4 endpoints)
- CRUD at `/api/v1/drawings`

### Sharing (2 endpoints)
- Create/get at `/api/v1/share`

### Analytics (3 endpoints)
- Track/view/get at `/api/v1/analytics`

### Catalog (2 endpoints)
- List/get at `/api/v1/catalog`

### Map Compositions (5 endpoints)
- CRUD at `/api/v1/instances/:instanceId/maps`

### Documents (4 endpoints)
- Upload/list/get/delete at `/api/v1/documents`

### SEO (1 endpoint)
- `GET /api/v1/seo/:instanceSlug`

### Adressage (7 endpoints)
- Address operations at `/api/v1/adressage`

### Analysis (1 endpoint)
- `POST /api/v1/analysis/spatial`

### Rasters (3 endpoints)
- Upload/download/info at `/api/v1/rasters`

**Total: ~120 endpoints across 31 route modules**

## Security Measures

### Input Validation
- All request bodies, query parameters, and path parameters validated with **Zod schemas**
- Type-safe validation at the presentation layer before reaching use cases

### SQL Injection Prevention
- **Prisma ORM** for all standard queries (parameterized by default)
- Raw PostGIS queries use parameterized SQL (`$1`, `$2` placeholders)
- Table/schema names validated against stored Layer records

### Authentication & Authorization
- **JWT RS256** asymmetric signing (separate access/refresh secrets)
- **Refresh token rotation** with family tracking to detect token reuse
- **Argon2id** password hashing with configurable memory/time/parallelism
- **Role-based access control** enforced via route-level `preHandler` hooks

### Rate Limiting
- Public endpoints: 10 requests/minute (default)
- Authenticated endpoints: 100 requests/minute
- Admin endpoints: 1000 requests/minute
- Configurable time window (default: 60 seconds)

### CORS
- Configurable origin via `CORS_ORIGIN` environment variable
- Default: `http://localhost:4200`

### Security Headers
- **Helmet** middleware applied globally (CSP disabled for API compatibility)

### File Upload Security
- Multipart upload handling via `@fastify/multipart`
- Files stored in MinIO (not on filesystem)
- Presigned URLs for downloads (time-limited access)

### Email Verification
- Registration requires email verification
- Password reset via time-limited tokens
