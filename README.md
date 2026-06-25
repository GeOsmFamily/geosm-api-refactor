# GeOSM API v3.0

**The backend API powering GeOSM -- an open-source geoportail platform for collaborative geographic data visualization and management.**

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node.js](https://img.shields.io/badge/node-20%2B-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)

---

## Description

GeOSM (Geographic Open Source Mapping) is a full-featured geoportail platform that enables organizations to publish, manage, and share geographic data through interactive web maps. It supports multiple map instances, layer management with OGC standards (WMS/WFS), spatial data import/export, geocoding, routing, and real-time collaboration.

This repository contains the **backend REST API** built with Fastify 5, following Clean Architecture principles. It provides a comprehensive set of endpoints for managing geospatial instances, layer catalogs, user authentication, data import/export pipelines, QGIS project integration, and more. The API serves as the backbone for the GeOSM frontend application, handling everything from user authentication to complex spatial data processing through BullMQ background workers.

The system integrates with PostGIS for spatial queries, QGIS Server for OGC services (WMS/WFS), MinIO for object storage, MeiliSearch for full-text search, Nominatim for geocoding, and OSRM for routing -- making it a complete geospatial data infrastructure.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                     │
│  Routes  │  Middleware  │  Plugins  │  Schemas           │
├─────────────────────────────────────────────────────────┤
│                   Application Layer                      │
│  Use Cases  │  DTOs  │  Service Interfaces               │
├─────────────────────────────────────────────────────────┤
│                     Domain Layer                         │
│  Entities  │  Enums  │  Errors  │  Repository Interfaces │
├─────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                    │
│  Prisma Repos  │  Redis  │  MinIO  │  BullMQ  │  GDAL   │
│  WebSocket  │  External APIs  │  QGIS  │  Email  │  OSM  │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Category | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.7 |
| Framework | Fastify 5 |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| ORM | Prisma 6 |
| Cache / Queue | Redis 7+ / BullMQ 5 |
| Auth | JWT (access + refresh tokens), Argon2 |
| Object Storage | MinIO |
| Search | MeiliSearch |
| Geospatial | PostGIS, GDAL/ogr2ogr, QGIS Server |
| Geocoding | Nominatim |
| Routing | OSRM |
| Observability | Winston logging, Prometheus metrics |
| Validation | Zod |
| DI Container | Awilix |
| WebSocket | @fastify/websocket |
| API Docs | Swagger / Swagger UI |
| Testing | Vitest |

---

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 16 with **PostGIS** 3.4 extension
- **Redis** 7+
- **MinIO** (S3-compatible object storage)
- **MeiliSearch** (full-text search engine)
- **QGIS Server** 3.28+ (OGC WMS/WFS services)
- **GDAL** with `ogr2ogr` CLI (spatial data conversion)
- **Python 3** with PyQGIS bindings (for QGIS project management scripts)
- **osm2pgsql** (OpenStreetMap data import)
- **Nominatim** instance (geocoding)
- **OSRM** instance (routing)

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/geosm/geosm-api.git
cd geosm-api

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration (see Environment Variables below)

# 4. Generate Prisma client
npm run db:generate

# 5. Run database migrations
npm run db:migrate

# 6. Seed the database (creates super admin user)
npm run db:seed

# 7. Start in development mode
npm run dev

# 8. Or build and start in production
npm run build
npm start
```

The API will be available at `http://localhost:3000` by default. Swagger UI is available at `http://localhost:3000/docs`.

---

## Environment Variables

All environment variables are validated at startup with Zod. Required variables have no default and will cause the server to fail if missing.

| Variable | Description | Default | Required |
|---|---|---|---|
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` | No |
| `PORT` | Server port | `3000` | No |
| `HOST` | Server host | `0.0.0.0` | No |
| `API_PREFIX` | API route prefix | `/api/v1` | No |
| `APP_NAME` | Application name | `GeOSM API` | No |
| `APP_URL` | Public application URL | `http://localhost:3000` | No |
| `DATABASE_URL` | PostgreSQL connection string (with PostGIS) | -- | **Yes** |
| `REDIS_HOST` | Redis host | `localhost` | No |
| `REDIS_PORT` | Redis port | `6379` | No |
| `REDIS_PASSWORD` | Redis password | `""` | No |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | -- | **Yes** |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | -- | **Yes** |
| `JWT_ACCESS_EXPIRATION` | Access token TTL | `15m` | No |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL | `7d` | No |
| `ARGON2_MEMORY_COST` | Argon2 memory cost (KiB) | `65536` | No |
| `ARGON2_TIME_COST` | Argon2 time cost (iterations) | `3` | No |
| `ARGON2_PARALLELISM` | Argon2 parallelism factor | `4` | No |
| `RATE_LIMIT_PUBLIC` | Rate limit for public endpoints (req/window) | `10` | No |
| `RATE_LIMIT_AUTHENTICATED` | Rate limit for authenticated endpoints | `100` | No |
| `RATE_LIMIT_ADMIN` | Rate limit for admin endpoints | `1000` | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `60000` | No |
| `SMTP_HOST` | SMTP server host | `localhost` | No |
| `SMTP_PORT` | SMTP server port | `587` | No |
| `SMTP_USER` | SMTP username | `""` | No |
| `SMTP_PASS` | SMTP password | `""` | No |
| `SMTP_FROM` | Default sender email address | `noreply@geosm.org` | No |
| `MINIO_ENDPOINT` | MinIO server endpoint | `localhost` | No |
| `MINIO_PORT` | MinIO server port | `9000` | No |
| `MINIO_ACCESS_KEY` | MinIO access key | `minio_access` | No |
| `MINIO_SECRET_KEY` | MinIO secret key | `minio_secret` | No |
| `MINIO_BUCKET` | MinIO bucket name | `geosm` | No |
| `MINIO_USE_SSL` | Enable SSL for MinIO | `false` | No |
| `MEILISEARCH_HOST` | MeiliSearch server URL | `http://localhost:7700` | No |
| `MEILISEARCH_API_KEY` | MeiliSearch API key | `masterKey` | No |
| `QGIS_SERVER_URL` | QGIS Server OWS endpoint | `http://localhost:8380/ows` | No |
| `QGIS_PROJECTS_DIR` | Directory for QGIS project files | `/var/www/qgis/projects` | No |
| `QGIS_STYLES_DIR` | Directory for QGIS style files | `/var/www/qgis/styles` | No |
| `DATA_DIR` | Temporary data directory | `/tmp/geosm-data` | No |
| `NOMINATIM_URL` | Nominatim geocoding service URL | `http://localhost:8081` | No |
| `OSRM_URL` | OSRM routing service URL | `http://localhost:5000` | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` | No |
| `PROMETHEUS_ENABLED` | Enable Prometheus metrics endpoint | `true` | No |
| `SUPER_ADMIN_EMAIL` | Default super admin email (used by seed) | `admin@geosm.org` | No |
| `SUPER_ADMIN_PASSWORD` | Default super admin password (used by seed) | `AdminP@ssw0rd!` | No |
| `SUPER_ADMIN_FIRST_NAME` | Super admin first name | `Super` | No |
| `SUPER_ADMIN_LAST_NAME` | Super admin last name | `Admin` | No |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:4200` | No |

---

## API Documentation

The API is served under the `/api/v1` prefix. Interactive Swagger documentation is available at `/docs` when the server is running.

### Health & Metrics

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Health check |
| GET | `/health/ready` | No | Readiness probe |
| GET | `/health/live` | No | Liveness probe |
| GET | `/metrics` | No | Prometheus metrics |

### Auth (`/api/v1/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | No | Register a new user |
| POST | `/login` | No | Login and receive tokens |
| POST | `/refresh` | No | Refresh access token |
| POST | `/logout` | No | Revoke refresh token |
| POST | `/verify-email` | No | Verify email address |
| POST | `/forgot-password` | No | Request password reset email |
| POST | `/reset-password` | No | Reset password with token |
| GET | `/profile` | Yes | Get current user profile |
| PATCH | `/profile` | Yes | Update current user profile |
| PUT | `/change-password` | Yes | Change password |

### Users (`/api/v1/users`) -- Super Admin only

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes (Super Admin) | List all users |
| GET | `/:id` | Yes (Super Admin) | Get user by ID |
| POST | `/` | Yes (Super Admin) | Create a new user |
| PATCH | `/:id` | Yes (Super Admin) | Update a user |
| DELETE | `/:id` | Yes (Super Admin) | Delete a user |
| PATCH | `/:id/role` | Yes (Super Admin) | Change user role |
| PATCH | `/:id/activate` | Yes (Super Admin) | Toggle user active status |

### Instances (`/api/v1/instances`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List all instances |
| GET | `/:id` | Yes | Get instance by ID |
| POST | `/` | Yes (Super Admin) | Create an instance |
| PATCH | `/:id` | Yes (Admin+) | Update an instance |
| DELETE | `/:id` | Yes (Super Admin) | Delete an instance |
| GET | `/:instanceId/users` | Yes (Admin+) | List instance users |
| POST | `/:instanceId/users` | Yes (Admin+) | Add user to instance |
| DELETE | `/:instanceId/users/:userId` | Yes (Admin+) | Remove user from instance |
| PATCH | `/:instanceId/users/:userId/role` | Yes (Admin+) | Change instance user role |

### Groups (`/api/v1/instances/:instanceId/groups`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List groups |
| GET | `/:id` | Yes | Get group by ID |
| POST | `/` | Yes (Admin+) | Create a group |
| PATCH | `/:id` | Yes (Admin+) | Update a group |
| DELETE | `/:id` | Yes (Admin+) | Delete a group |
| PATCH | `/reorder` | Yes (Admin+) | Reorder groups |

### Sub-groups (`/api/v1/groups/:groupId/sub-groups`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List sub-groups |
| GET | `/:id` | Yes | Get sub-group by ID |
| POST | `/` | Yes (Admin+) | Create a sub-group |
| PATCH | `/:id` | Yes (Admin+) | Update a sub-group |
| DELETE | `/:id` | Yes (Admin+) | Delete a sub-group |

### Layers (`/api/v1/instances/:instanceId/layers`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List layers |
| GET | `/:id` | Yes | Get layer by ID |
| POST | `/` | Yes (Editor+) | Create a layer |
| PATCH | `/:id` | Yes (Editor+) | Update a layer |
| DELETE | `/:id` | Yes (Editor+) | Delete a layer |

### Layer Import (`/api/v1/layers`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/:layerId/import` | Yes (Editor+) | Import spatial data (multipart file upload) |
| GET | `/exports/:exportId/download` | Yes | Download an export file |

### Features (`/api/v1/layers/:layerId/features`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List features (with spatial filters) |
| GET | `/:featureId` | Yes | Get feature by ID |
| POST | `/` | Yes (Editor+) | Add a feature |
| PATCH | `/:featureId` | Yes (Editor+) | Update a feature |
| DELETE | `/:featureId` | Yes (Editor+) | Delete a feature |

### Styles (`/api/v1/layers/:layerId/style`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | Get layer style |
| PUT | `/sld` | Yes (Editor+) | Update SLD style |
| PUT | `/mapbox` | Yes (Editor+) | Update Mapbox style |
| POST | `/reset` | Yes (Editor+) | Reset to default style |
| GET | `/defaults` | Yes | List default styles |

### Exports (`/api/v1/exports`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | Yes | Create an export job |
| GET | `/` | Yes | List user's exports |
| GET | `/:id` | Yes | Get export details |
| GET | `/:id/download` | Yes | Download export file |
| DELETE | `/:id` | Yes | Delete an export |

### Geocoding (`/api/v1/geocode`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/search` | No | Forward geocoding search |
| GET | `/reverse` | No | Reverse geocoding (lat/lng to address) |
| GET | `/lookup` | No | Lookup by OSM ID |

### Routing (`/api/v1/routing`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/route` | No | Calculate route between points |
| GET | `/nearest` | No | Find nearest road segment |

### Search (`/api/v1/search`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | No | Global search across all content |
| GET | `/layers` | No | Search layers |
| GET | `/features` | No | Search features |

### QGIS Projects (`/api/v1/instances/:instanceId/qgis-project`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | Get QGIS project for instance |
| POST | `/reload` | Yes (Admin+) | Reload QGIS project |

### WMS/WFS Proxy

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/wms` | No | WMS proxy to QGIS Server |
| GET | `/api/v1/wfs` | No | WFS proxy to QGIS Server |

### Geoportail (`/api/v1/geoportail`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/altitude` | No | Get altitude for coordinates |
| POST | `/elevation-profile` | No | Get elevation profile along a line |
| GET | `/admin-boundary` | No | Find administrative boundary |
| GET | `/geolocate` | No | Geolocate by IP address |
| POST | `/layers/:layerId/stats` | Yes | Get layer statistics |

### OSM (`/api/v1/osm`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/query` | Yes | Query OSM data |
| POST | `/create-table` | Yes (Super Admin) | Create PostGIS table from OSM data |

### Base Maps (`/api/v1/instances/:instanceId/base-maps`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | No | List base maps |
| POST | `/` | Yes (Admin+) | Create a base map |
| PATCH | `/:id` | Yes (Admin+) | Update a base map |
| DELETE | `/:id` | Yes (Admin+) | Delete a base map |

### Default Themes (`/api/v1/default-themes`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | No | List default themes |
| GET | `/:id` | No | Get theme by ID |
| POST | `/` | Yes (Super Admin) | Create a theme |
| PATCH | `/:id` | Yes (Super Admin) | Update a theme |
| DELETE | `/:id` | Yes (Super Admin) | Delete a theme |
| GET | `/:id/tags` | No | Get theme tags |
| POST | `/:id/tags` | Yes (Super Admin) | Create a theme tag |
| POST | `/seed` | Yes (Super Admin) | Seed default themes |

### Drawings (`/api/v1/drawings`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List user drawings |
| GET | `/:id` | Yes | Get drawing by ID |
| POST | `/` | Yes | Save a drawing (GeoJSON) |
| DELETE | `/:id` | Yes | Delete a drawing |

### Sharing (`/api/v1/share`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | Yes | Create a shared map link |
| GET | `/:code` | No | Get shared map by short code |

### Analytics (`/api/v1/analytics`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/track` | No | Track an analytics event |
| POST | `/view` | No | Increment view counter |
| GET | `/` | Yes (Super Admin) | Get analytics data |

### Catalog (`/api/v1/catalog`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | No | Get full catalog |
| GET | `/:instanceSlug` | No | Get catalog for an instance |

### Maps (`/api/v1/instances/:instanceId/maps`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List map compositions |
| GET | `/:id` | Yes | Get map composition |
| POST | `/` | Yes | Create a map composition |
| PUT | `/:id` | Yes | Update a map composition |
| DELETE | `/:id` | Yes | Delete a map composition |

### Documents (`/api/v1/documents`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List documents |
| GET | `/:id` | Yes | Get document by ID |
| POST | `/` | Yes | Upload a document |
| DELETE | `/:id` | Yes | Delete a document |

### SEO (`/api/v1/seo`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:instanceSlug` | No | Get SEO metadata for an instance |

### Admin (`/api/v1/admin`) -- Super Admin only

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard` | Yes (Super Admin) | Get admin dashboard stats |
| GET | `/jobs` | Yes (Super Admin) | List background jobs |
| GET | `/jobs/:id` | Yes (Super Admin) | Get job details |
| POST | `/jobs/:id/retry` | Yes (Super Admin) | Retry a failed job |
| POST | `/osm/import` | Yes (Super Admin) | Import OSM PBF data |
| GET | `/health` | Yes (Super Admin) | System health check |
| POST | `/cache/clear` | Yes (Super Admin) | Clear Redis cache |

### WebSocket (`/ws/notifications`)

Authenticated WebSocket endpoint for real-time notifications. Requires a valid JWT token.

---

## Database Schema

The database uses PostgreSQL with PostGIS extensions. Key models and their relationships:

- **User** -- Authentication, roles (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR, VIEWER)
- **Instance** -- A geoportail instance (project/organization), has groups, layers, base maps
- **InstanceUser** -- Many-to-many between users and instances with per-instance roles
- **Group** -- Thematic grouping of layers within an instance
- **SubGroup** -- Sub-category within a group, contains layers
- **Layer** -- A map layer with geometry type, source configuration, and spatial table reference
- **LayerStyle** -- SLD or Mapbox GL styles attached to a layer
- **LayerAction** -- Configurable actions per layer (download, share, print, measure, routing, comment)
- **QgisProject** -- QGIS project file reference for WMS/WFS serving
- **BaseMap** -- Background map tiles (XYZ, WMS, WMTS, Mapbox)
- **Export** -- Async export jobs (GeoJSON, Shapefile, GeoPackage, KML, CSV, PDF)
- **Drawing** -- User-created GeoJSON drawings
- **SharedMap** -- Shareable map state snapshots with short codes
- **MapComposition** -- Saved map compositions with layer selections and viewport
- **Document** -- File attachments linked to layers or instances
- **AnalyticsEvent** -- Usage tracking events
- **DefaultTheme / DefaultTag** -- Predefined thematic categories

---

## Queue System

The API uses **BullMQ** with Redis for background job processing. Two worker queues are registered:

### `layer-import` Queue
Handles spatial data import from uploaded files (GeoJSON, Shapefile, GeoPackage, KML, CSV). The worker:
1. Downloads the uploaded file from MinIO
2. Uses `ogr2ogr` to convert and import data into a PostGIS table
3. Updates the layer record with the table reference
4. Sends real-time progress notifications via WebSocket

### `layer-export` Queue
Handles spatial data export to various formats. The worker:
1. Reads features from PostGIS using `ogr2ogr`
2. Converts to the requested format (GeoJSON, Shapefile, GeoPackage, KML, CSV, PDF)
3. Uploads the result to MinIO
4. Notifies the user via WebSocket when the export is ready for download

---

## PyQGIS Scripts

Located in `python_scripts/`, these scripts manage QGIS Server projects:

| Script | Purpose |
|---|---|
| `add_vector_layer.py` | Add a PostGIS vector layer to a QGIS project |
| `remove_layer.py` | Remove a layer from a QGIS project |
| `save_style.py` | Save a layer style (SLD) to the QGIS project |
| `set_style.py` | Apply a style to a layer in the QGIS project |
| `reload_project.py` | Reload a QGIS project to pick up changes |
| `clip_export.py` | Export and clip layer data to a bounding box |
| `setup_wms_capabilities.py` | Configure WMS capabilities for a QGIS project |

These scripts require Python 3 with PyQGIS bindings and are invoked by the API via child processes.

---

## WebSocket Events

The WebSocket endpoint at `/ws/notifications` sends real-time events to authenticated users:

| Event | Description |
|---|---|
| `import:progress` | Layer import progress update |
| `import:completed` | Layer import completed successfully |
| `import:failed` | Layer import failed |
| `export:progress` | Export job progress update |
| `export:completed` | Export ready for download |
| `export:failed` | Export job failed |
| `ping` / `pong` | Connection keepalive |

---

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

Tests are written with **Vitest** and follow the same Clean Architecture boundaries as the source code.

---

## Project Structure

```
src/
├── server.ts                    # Application bootstrap
├── container.ts                 # Awilix DI container setup
├── config/                      # Environment and app configuration
├── domain/                      # Domain entities, enums, errors, repository interfaces
├── application/                 # Application layer
│   ├── dtos/                    # Data transfer objects
│   ├── services/                # Service interfaces (email, password, token)
│   └── use-cases/               # Business logic organized by module
│       ├── admin/
│       ├── analytics/
│       ├── auth/
│       ├── base-maps/
│       ├── catalog/
│       ├── default-themes/
│       ├── documents/
│       ├── drawings/
│       ├── exports/
│       ├── features/
│       ├── geocoding/
│       ├── geoportail/
│       ├── groups/
│       ├── instances/
│       ├── layers/
│       ├── maps/
│       ├── osm/
│       ├── qgis-projects/
│       ├── routing/
│       ├── search/
│       ├── seo/
│       ├── sharing/
│       ├── styles/
│       ├── sub-groups/
│       └── users/
├── infrastructure/              # Infrastructure implementations
│   ├── auth/                    # Argon2, JWT services
│   ├── cache/                   # Redis service
│   ├── database/                # Prisma repositories, PostGIS, OSM queries
│   │   ├── prisma/              # Schema and migrations
│   │   └── repositories/        # Prisma repository implementations
│   ├── email/                   # SMTP service
│   ├── external-apis/           # Nominatim, OSRM, MeiliSearch, QGIS Server
│   ├── gdal/                    # ogr2ogr service
│   ├── observability/           # Winston logger
│   ├── osm/                     # osm2pgsql service
│   ├── qgis/                    # QGIS project management service
│   ├── queue/                   # BullMQ queue service and workers
│   ├── storage/                 # MinIO storage service
│   └── websocket/               # WebSocket notification service
└── presentation/                # HTTP layer
    ├── middleware/               # Error handler, RBAC, request logger, metrics
    ├── plugins/                  # Fastify plugins (auth, cors, swagger, websocket, multipart)
    ├── routes/                   # Route handlers organized by module
    └── schemas/                  # Zod validation schemas

python_scripts/                  # PyQGIS scripts for QGIS project management
prisma/                          # Prisma seed script
```

---

## Deployment

### Docker

The application is designed to run in containers. Key considerations:

- Mount `QGIS_PROJECTS_DIR` and `QGIS_STYLES_DIR` as volumes shared with QGIS Server
- Ensure GDAL/ogr2ogr and Python 3 + PyQGIS are available in the container
- Connect to the same PostgreSQL instance with PostGIS extensions enabled
- Redis must be accessible for both caching and BullMQ job queues

### Production Environment Variables

For production, ensure you set:

- `NODE_ENV=production`
- Strong, unique values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- Proper `DATABASE_URL` with connection pooling
- Secure `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`
- A real SMTP server for email functionality
- `CORS_ORIGIN` set to your frontend domain
- `SUPER_ADMIN_PASSWORD` changed from the default

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

Copyright (c) 2024-2025 GeOSM Family
