# Architecture de GeOSM API v3.0

## Vue d'ensemble

**GeOSM** (Geographic OpenStreetMap) v3.0 est un geoportail open-source concu pour la gestion, la visualisation et le partage de donnees geographiques, principalement en Afrique. Le systeme repose **principalement sur les donnees OpenStreetMap** : l'import de donnees OSM via osm2pgsql constitue la base, puis les donnees non-OSM (uploads utilisateur, rasters) completent le catalogue.

La plateforme couvre le cycle de vie complet des donnees geographiques :
1. **Import** -- Donnees OSM (osm2pgsql -> tables planet_osm_*) et donnees non-OSM (upload -> ogr2ogr -> PostGIS)
2. **Stockage** -- PostgreSQL/PostGIS pour les donnees spatiales, MinIO pour les fichiers
3. **Stylisation** -- SLD et Mapbox GL via l'API, appliques aux projets QGIS
4. **Visualisation** -- WMS/WFS via QGIS Server, tuiles vectorielles
5. **Edition** -- CRUD de features geographiques via l'API REST
6. **Analyse** -- Operations spatiales (buffer, intersection, union, difference)
7. **Export** -- Multi-format (GeoJSON, Shapefile, GeoPackage, KML, CSV, PDF)
8. **Partage** -- Cartes partagees avec codes courts, compositions de carte

---

## Diagramme d'architecture systeme

```
                          +------------+
                          |  Frontend  |
                          |   (SPA)    |
                          +-----+------+
                                | HTTP / WebSocket
                                v
                     +----------------------+
                     |    GeOSM API         |
                     |    (Fastify 5)       |
                     |    Port 3000         |
                     +----------+-----------+
                     |  BullMQ Workers      |
                     |  (in-process)        |
                     +--+--+--+--+--+--+---+
                        |  |  |  |  |  |
         +--------------+  |  |  |  |  +------------------+
         v                 |  |  |  |                      v
+-----------------+        |  |  |  |          +-------------------+
| PostgreSQL 16   |        |  |  |  |          | QGIS Server 3.28 |
| + PostGIS 3.4   |<-------+  |  |  |          | Port 8380         |
| Port 5432       |           |  |  +------+   | (WMS/WFS)         |
|                 |           |  |         |   +--------+----------+
| - Modeles       |           v  |         v            |
|   Prisma (19)   |     +--------+  +----------+       | lit les
| - Tables        |     | Redis  |  | MinIO    |       | projets
|   spatiales     |     | 7      |  | (S3)     |       | .qgs
| - Tables OSM    |     | Port   |  | Port     |       |
|   (planet_      |     | 6379   |  | 9000     |  +----v----------+
|    osm_*)       |     +--------+  +----------+  | Fichiers QGIS |
+-----------------+          |                     | (.qgs)        |
                        +----+----+                +---------------+
                        | BullMQ  |
                        | Files : |
                        | layer-  |
                        | import  |
                        | layer-  |
                        | export  |
                        | location|
                        | -plan   |
                        | schedu- |
                        | led-osm |
                        | -import |
                        | (cron)  |
                        +---------+

                    Services externes
        +-----------+  +----------+  +--------------+
        | Nominatim |  | OSRM     |  | MeiliSearch  |
        | Geocodage |  | Routage  |  | Recherche    |
        | Port 8081 |  | Port 5000|  | Port 7700    |
        +-----------+  +----------+  +--------------+
```

---

## Couches de la Clean Architecture

Le projet suit les principes de la **Clean Architecture** (Architecture Hexagonale). Les dependances pointent vers l'interieur : Presentation -> Application -> Domaine. L'infrastructure implemente les interfaces definies par les couches interieures.

### Couche Presentation (`src/presentation/`)

Responsable de la communication HTTP avec les clients.

- **Routes** (31 modules) : Definissent les endpoints HTTP, resolvent les cas d'utilisation depuis le conteneur DI Awilix, valident les entrees avec Zod et formatent les reponses
- **Middleware** :
  - `error-handler.middleware.ts` -- Gestionnaire d'erreurs global (traduit les erreurs domaine en codes HTTP)
  - `request-logger.middleware.ts` -- Journalisation des requetes/reponses
  - `metrics.middleware.ts` -- Collecte de metriques Prometheus
- **Plugins** :
  - `auth.plugin.ts` -- Decorateur d'authentification JWT (`authenticate`, `requireRole`)
  - `cors.plugin.ts` -- Configuration CORS
  - `swagger.plugin.ts` -- Documentation OpenAPI automatique
  - `websocket.plugin.ts` -- Support WebSocket pour les notifications temps reel
  - `multipart.plugin.ts` -- Gestion des uploads de fichiers
- **Schemas** : Schemas Zod pour la validation des requetes/reponses

### Couche Application (`src/application/`)

Contient la logique metier sous forme de **cas d'utilisation** (90+ use cases). Chaque cas d'utilisation est une classe avec une seule methode `execute()`.

| Categorie | Cas d'utilisation | Nombre |
|---|---|---|
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

### Couche Domaine (`src/domain/`)

Coeur du systeme, sans aucune dependance externe.

- **Entites** : User, Instance, InstanceUser, Group, SubGroup, Layer, LayerStyle, LayerAction, BaseMap, Export, QgisProject, DefaultTheme, DefaultTag, Drawing, SharedMap, AnalyticsEvent, MapComposition, Document, RefreshToken
- **Enumerations** :
  - `Role` : SUPER_ADMIN, ADMIN_INSTANCE, EDITOR, VIEWER
  - `GeometryType` : POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON
  - `SourceType` : WMS, WFS, WMTS, GEOJSON, MVT, XYZ
  - `ActionType` : DOWNLOAD, SHARE, PRINT, MEASURE, ROUTING, COMMENT
  - `ExportFormat` : GEOJSON, SHAPEFILE, GEOPACKAGE, KML, CSV, PDF
  - `JobStatus` : PENDING, PROCESSING, COMPLETED, FAILED
  - `BaseMapType` : XYZ, WMS, WMTS, MAPBOX
- **Erreurs** : Classes d'erreurs specifiques au domaine
- **Interfaces de depots** : Contrats d'acces aux donnees (ports)

### Couche Infrastructure (`src/infrastructure/`)

Implementations concretes des interfaces definies par les couches superieures.

| Service | Implementation | Role |
|---|---|---|
| Base de donnees | Prisma + SQL brut | ORM pour 19 modeles, requetes brutes pour PostGIS |
| PostGIS | `postgis.service.ts` | Operations SQL spatiales (ST_GeomFromGeoJSON, ST_AsGeoJSON, ST_Intersects, etc.) |
| Requetes OSM | `osm-query.service.ts` | Requetes sur les tables planet_osm_* |
| osm2pgsql | `osm2pgsql.service.ts` | Import de fichiers PBF dans PostGIS |
| File d'attente | BullMQ via `queue.service.ts` | Traitement asynchrone (layer-import, layer-export, location-plan) + job recurrent cron (scheduled-osm-import, voir `addRepeatableJob`) |
| Stockage | MinIO via `minio.service.ts` | Stockage objet pour uploads/exports |
| Cache | Redis via `redis.service.ts` | Cache, backend de file d'attente |
| Recherche | MeiliSearch via `meilisearch.service.ts` | Indexation et recherche full-text |
| QGIS | `qgis-project.service.ts` + `qgis-server.service.ts` | Gestion de projets, proxy WMS/WFS |
| GDAL | `ogr2ogr.service.ts` + `raster.service.ts` | Conversion de formats, traitement raster |
| Email | SMTP via `smtp.service.ts` | Emails transactionnels |
| Auth | `argon2-password.service.ts` + `jwt-token.service.ts` | Hachage de mots de passe, tokens JWT |
| Geocodage | Nominatim via `nominatim.service.ts` | Recherche d'adresses |
| Routage | OSRM via `osrm.service.ts` | Calcul d'itineraires |
| WebSocket | `notification.service.ts` | Notifications temps reel |
| Observabilite | Winston + prom-client + OpenTelemetry | Logs (Winston/GELF), metriques (Prometheus), tracing (Jaeger/OTLP), alertes (Slack/Email) |
| Adressage | `adressage.service.ts` | Service de geocodage adresse |
| SVG | `svg-generator.service.ts` | Generation d'icones |

---

## Architecture de la base de donnees

### Schema public -- Modeles Prisma (19 modeles)

```
+----------+     +--------------+     +---------+
|   User   |----<| RefreshToken |     |Instance |
|          |     +--------------+     |         |
|          |----<+--------------+---->|         |
|          |     | InstanceUser |     |         |
+----+-----+     +--------------+     +----+----+
     |                                     |
     |  +--------+                    +----+----+
     +-<| Export  |--->+-------+ <----|  Group  |
        +--------+    | Layer |      +----+----+
                      |       |           |
     +------------+-->|       |<--+-------+---+
     | QgisProject|   |       |   |  SubGroup |
     +------------+   +---+---+   +-----------+
                          |
              +-----------+-----------+
              v           v           v
        +----------+ +----------+ +---------+
        |LayerStyle| |LayerAction| | Export  |
        +----------+ +----------+ +---------+

+----------+  +----------+  +----------------+
| BaseMap  |  | Drawing  |  | AnalyticsEvent |
+----------+  +----------+  +----------------+

+-----------+  +----------------+  +----------+
| SharedMap |  |MapComposition  |  | Document |
+-----------+  +----------------+  +----------+

+--------------+     +------------+
| DefaultTheme |----<| DefaultTag |
+--------------+     +------------+
```

### Relations principales

- **User** possede : RefreshTokens, Exports, InstanceUsers
- **Instance** possede : Groups, Layers, BaseMaps, QgisProjects, InstanceUsers
- **Group** appartient a Instance, possede des SubGroups
- **SubGroup** appartient a Group, possede des Layers
- **Layer** appartient a SubGroup + Instance + QgisProject (optionnel), possede des LayerStyles, LayerActions, Exports
- **DefaultTheme** possede des DefaultTags

### Schemas dynamiques par instance

Quand une couche est creee a partir d'un import de donnees, une table PostGIS dediee est creee avec :
- `gid` (cle primaire serial)
- `geom` (colonne geometrique, SRID 4326)
- Colonnes d'attributs dynamiques issues des donnees sources

Referencee par `Layer.tableName` et `Layer.schemaName`.

### Tables OSM (planet_osm_*)

Creees par osm2pgsql a partir d'imports PBF :

| Table | Description |
|---|---|
| `planet_osm_point` | Entites ponctuelles (commerces, equipements, etc.) |
| `planet_osm_line` | Entites lineaires (routes, rivieres, etc.) |
| `planet_osm_polygon` | Entites surfaciques (batiments, occupation du sol, etc.) |
| `planet_osm_roads` | Entites routieres (sous-ensemble optimise pour le rendu) |

Ces tables contiennent les colonnes standard d'osm2pgsql (osm_id, name, highway, building, amenity, etc.) et une colonne geometrique `way`.

---

## Architecture multi-instance

Chaque **Instance** represente un deploiement geographique (typiquement un pays ou une region) :

- **Isolation des donnees** : Groups, SubGroups, Layers, BaseMaps et QgisProjects sont rattaches a une instance
- **Affectation des utilisateurs** : Les utilisateurs sont assignes aux instances via `InstanceUser` avec des roles par instance
- **Configuration** : Chaque instance a sa propre bbox, coordonnees du centre, zoom par defaut, logo
- **Projets QGIS** : Fichiers .qgs separes par instance pour le service WMS/WFS
- **Routage par slug** : Les instances sont identifiees par des slugs uniques (ex: `cameroon`, `senegal`)

### Roles par instance

Un utilisateur peut avoir des roles differents selon les instances. Le modele `InstanceUser` stocke `userId + instanceId + role`, avec une contrainte d'unicite sur `(userId, instanceId)`.

---

## Authentification et autorisation

### Flux JWT

1. **Inscription** : L'utilisateur s'inscrit avec email/mot de passe. Le mot de passe est hache avec Argon2id (memoire : 64 Mo, iterations : 3, parallelisme : 4)
2. **Connexion** : Verification des identifiants, emission d'un access token JWT (15 min) + refresh token (7 jours)
3. **Acces** : Bearer token dans l'en-tete Authorization, verifie a chaque requete
4. **Rafraichissement** : Quand l'access token expire, utiliser le refresh token pour obtenir une nouvelle paire (rotation des tokens avec suivi par famille)
5. **Deconnexion** : Revocation de tous les tokens de la famille du refresh token

### Matrice RBAC

| Action | SUPER_ADMIN | ADMIN_INSTANCE | EDITOR | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Gerer les utilisateurs (global) | Oui | - | - | - |
| Creer des instances | Oui | - | - | - |
| Supprimer des instances | Oui | - | - | - |
| Modifier une instance | Oui | Oui (la sienne) | - | - |
| Gerer les utilisateurs d'instance | Oui | Oui (la sienne) | - | - |
| Creer/modifier des groupes | Oui | Oui (la sienne) | - | - |
| Creer/modifier des sous-groupes | Oui | Oui (la sienne) | - | - |
| Creer/modifier des couches | Oui | Oui (la sienne) | Oui | - |
| Creer/modifier des features | Oui | Oui (la sienne) | Oui | - |
| Importer des donnees de couche | Oui | Oui (la sienne) | Oui | - |
| Modifier les styles | Oui | Oui (la sienne) | Oui | - |
| Voir les couches/features | Oui | Oui | Oui | Oui |
| Exporter des donnees | Oui | Oui | Oui | Oui |
| Tableau de bord admin/jobs | Oui | - | - | - |
| Import OSM | Oui | - | - | - |
| Gerer les themes par defaut | Oui | - | - | - |
| Creer des fonds de carte | Oui | Oui (la sienne) | - | - |
| Gerer les projets QGIS | Oui | Oui (la sienne) | - | - |
| Uploader des rasters | Oui | Oui (la sienne) | - | - |

---

## Liste complete des endpoints par module

L'API est servie sous le prefixe `/api/v1` (configurable via `API_PREFIX`). Au total, environ **120 endpoints** repartis dans **31 modules de routes**.

### Sante et metriques (4 endpoints)
- `GET /health` -- Verification de sante
- `GET /health/ready` -- Sonde de disponibilite
- `GET /health/live` -- Sonde de vivacite
- `GET /metrics` -- Metriques Prometheus (format texte)

### Auth (10 endpoints) -- `/api/v1/auth`
- `POST /register` -- Inscription
- `POST /login` -- Connexion
- `POST /refresh` -- Rafraichissement de token
- `POST /logout` -- Deconnexion
- `POST /verify-email` -- Verification d'email
- `POST /forgot-password` -- Mot de passe oublie
- `POST /reset-password` -- Reinitialisation du mot de passe
- `GET /me` -- Profil utilisateur (authentifie)
- `PATCH /me` -- Mise a jour du profil (authentifie)
- `PUT /me/password` -- Changement de mot de passe (authentifie)

### Users (7 endpoints) -- `/api/v1/users` (SUPER_ADMIN)
- `GET /` -- Liste des utilisateurs (pagine, recherche, filtre par role/actif)
- `GET /:id` -- Detail d'un utilisateur
- `POST /` -- Creation d'un utilisateur
- `PATCH /:id` -- Mise a jour
- `DELETE /:id` -- Suppression
- `PATCH /:id/role` -- Changement de role
- `PATCH /:id/activate` -- Activation/desactivation

### Instances (9 endpoints) -- `/api/v1/instances`
- `GET /` -- Liste (pagine, recherche)
- `GET /:id` -- Detail
- `POST /` -- Creation (SUPER_ADMIN)
- `PATCH /:id` -- Mise a jour (SUPER_ADMIN, ADMIN_INSTANCE)
- `DELETE /:id` -- Suppression (SUPER_ADMIN)
- `GET /:instanceId/users` -- Utilisateurs de l'instance
- `POST /:instanceId/users` -- Ajouter un utilisateur
- `DELETE /:instanceId/users/:userId` -- Retirer un utilisateur
- `PATCH /:instanceId/users/:userId/role` -- Changer le role

### Groups (6 endpoints) -- `/api/v1/instances/:instanceId/groups`
- `GET /` -- Liste
- `GET /:id` -- Detail
- `POST /` -- Creation (SUPER_ADMIN, ADMIN_INSTANCE)
- `PATCH /:id` -- Mise a jour
- `DELETE /:id` -- Suppression
- `PATCH /reorder` -- Reordonnancement

### Sub-Groups (5 endpoints) -- `/api/v1/groups/:groupId/sub-groups`
- `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`

### Layers (6 endpoints) -- `/api/v1/instances/:instanceId/layers`
- `GET /` -- Liste (pagine, recherche, filtre par geometrie/sous-groupe)
- `GET /:id` -- Detail
- `POST /` -- Creation (EDITOR+)
- `PATCH /:id` -- Mise a jour (EDITOR+)
- `DELETE /:id` -- Suppression (EDITOR+)
- `GET /:id/source-file` -- Fichier source

### Features (5 endpoints) -- `/api/v1/layers/:layerId/features`
- `GET /` -- Liste (avec filtres spatiaux bbox, limit, offset)
- `GET /:featureId` -- Detail
- `POST /` -- Ajout (EDITOR+)
- `PATCH /:featureId` -- Mise a jour (EDITOR+)
- `DELETE /:featureId` -- Suppression (EDITOR+)

### Styles (5 endpoints) -- `/api/v1/layers/:layerId/style`
- `GET /`, `PUT /sld`, `PUT /mapbox`, `POST /reset`, `GET /defaults`

### Base Maps (4 endpoints) -- `/api/v1/instances/:instanceId/base-maps`
- `GET /` (public), `POST /`, `PATCH /:id`, `DELETE /:id`

### Exports (5 endpoints) -- `/api/v1/exports`
- `POST /`, `GET /`, `GET /:id`, `GET /:id/download`, `DELETE /:id`

### Import de couche (2 endpoints) -- `/api/v1/layers`
- `POST /:layerId/import` -- Import multipart (EDITOR+)
- `GET /exports/:exportId/download` -- Telechargement

### Geocodage (3 endpoints) -- `/api/v1/geocode` (public)
- `GET /search`, `GET /reverse`, `GET /lookup`

### Routage (2 endpoints) -- `/api/v1/routing` (public)
- `GET /route`, `GET /nearest`

### Recherche (3 endpoints) -- `/api/v1/search` (public)
- `GET /`, `GET /layers`, `GET /features`

### QGIS Projects (2 endpoints) -- `/api/v1/instances/:instanceId/qgis-project`
- `GET /`, `POST /reload`

### Proxy WMS/WFS (2 endpoints) (public)
- `GET /api/v1/wms`, `GET /api/v1/wfs`

### OSM (2 endpoints) -- `/api/v1/osm`
- `POST /query` (authentifie), `POST /create-table` (SUPER_ADMIN)

### Themes par defaut (8 endpoints) -- `/api/v1/default-themes`
- CRUD + tags + seed

### Admin (13 endpoints) -- `/api/v1/admin` (SUPER_ADMIN)
- Dashboard, jobs, import OSM, cache, icones, config BD, templates, sequences

### Geoportail (7 endpoints) -- `/api/v1/geoportail`
- Altitude, profil altimetrique, limites admin, geolocalisation, stats, search-limit, save-coord-pdf

### Dessins (4 endpoints) -- `/api/v1/drawings`
- CRUD (authentifie)

### Partage (2 endpoints) -- `/api/v1/share`
- Creation (authentifie), consultation (public)

### Analytiques (3 endpoints) -- `/api/v1/analytics`
- Track, view (public), consultation (SUPER_ADMIN)

### Catalogue (2 endpoints) -- `/api/v1/catalog` (public)
- Liste complete, par instance

### Compositions de carte (5 endpoints) -- `/api/v1/instances/:instanceId/maps`
- CRUD (authentifie)

### Documents (4 endpoints) -- `/api/v1/documents`
- Upload, liste, detail, suppression (authentifie)

### SEO (1 endpoint) -- `/api/v1/seo` (public)
- `GET /:instanceSlug`

### Adressage (7 endpoints) -- `/api/v1/adressage` (public)
- Adresse, position, points, search, click, code-usage, elastic-data

### Analyse spatiale (1 endpoint) -- `/api/v1/analysis` (public)
- `POST /spatial`

### Rasters (3 endpoints) -- `/api/v1/rasters`
- Upload (ADMIN+), download, info (authentifie)

### WebSocket -- `/ws/notifications`
- Notifications temps reel (authentifie via JWT)

---

## Securite

### Validation des entrees
- Tous les corps de requete, parametres de requete et parametres de chemin sont valides avec des **schemas Zod**
- Validation typee a la couche presentation avant d'atteindre les cas d'utilisation

### Prevention des injections SQL
- **Prisma ORM** pour toutes les requetes standard (parametrees par defaut)
- Les requetes PostGIS brutes utilisent du SQL parametre (`$1`, `$2`)
- Les noms de tables/schemas sont valides contre les enregistrements Layer stockes

### Authentification et autorisation
- **JWT** avec secrets separes pour access/refresh tokens
- **Rotation des refresh tokens** avec suivi par famille pour detecter la reutilisation
- **Argon2id** pour le hachage des mots de passe (memoire, iterations et parallelisme configurables)
- **Controle d'acces base sur les roles (RBAC)** applique via des hooks `preHandler` au niveau des routes

### Limitation de debit
- Endpoints publics : 10 requetes/minute (par defaut)
- Endpoints authentifies : 100 requetes/minute
- Endpoints admin : 1000 requetes/minute
- Fenetre configurable (defaut : 60 secondes)

### CORS
- Origine configurable via `CORS_ORIGIN`
- Defaut : `http://localhost:4200`

### En-tetes de securite
- Middleware **Helmet** applique globalement (CSP desactive pour compatibilite API)

### Securite des uploads de fichiers
- Gestion multipart via `@fastify/multipart` (limite : 100 Mo)
- Fichiers stockes dans MinIO (pas sur le systeme de fichiers)
- URLs pre-signees pour les telechargements (acces limite dans le temps)

### Verification d'email
- L'inscription necessite la verification de l'email
- Reinitialisation du mot de passe via tokens a duree limitee

---

## Observabilite

L'architecture d'observabilite repose sur 4 piliers :

### Metriques (Prometheus + Grafana)

- **prom-client** collecte les metriques applicatives (duree HTTP, compteurs, memoire, event loop)
- **Prometheus** scrape l'endpoint `GET /metrics` toutes les 15 secondes
- **Grafana** (port 3001) fournit des tableaux de bord preconfigures

### Tracing distribue (Jaeger + OpenTelemetry)

- L'API envoie les traces via le protocole **OTLP** au collecteur Jaeger (port 4318)
- **Jaeger UI** (port 16686) permet de visualiser les traces et analyser les latences
- Variable : `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`

### Logs centralises (Graylog + GELF)

- **Winston** envoie les logs au format GELF (UDP) vers Graylog
- **Graylog** (port 9009) centralise, indexe et permet la recherche dans les logs
- Backends : MongoDB (stockage config) + OpenSearch (indexation)
- Variables : `GRAYLOG_HOST`, `GRAYLOG_PORT=12201`

### Alertes

- **Slack** : notifications via webhook (`SLACK_WEBHOOK_URL`)
- **Email** : alertes par email (`ALERT_EMAIL_TO`)
- Le service `AlertingService` gere l'envoi des alertes critiques

### Diagramme d'observabilite

```
GeOSM API
  |-- metriques --> Prometheus --> Grafana (dashboards)
  |-- traces    --> Jaeger (OTLP, port 4318) --> Jaeger UI (port 16686)
  |-- logs      --> Graylog (GELF, port 12201) --> OpenSearch
  |-- alertes   --> Slack / Email
```
