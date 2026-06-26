# GeOSM API v3.0 -- Backend du geoportail open-source base sur OpenStreetMap

![CI](https://github.com/GeOsmFamily/geosm-api-refactor/actions/workflows/ci.yml/badge.svg)
![Securite](https://github.com/GeOsmFamily/geosm-api-refactor/actions/workflows/security.yml/badge.svg)
![Qualite](https://github.com/GeOsmFamily/geosm-api-refactor/actions/workflows/code-quality.yml/badge.svg)
![Licence](https://img.shields.io/badge/licence-MIT-blue)
![Node.js](https://img.shields.io/badge/node-22%2B-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)

---

## Description

**GeOSM** (Geographic OpenStreetMap) est un geoportail open-source qui permet de **visualiser, gerer et diffuser des donnees geographiques**, principalement issues d'**OpenStreetMap**. Concu pour l'Afrique, il offre une infrastructure SIG complete permettant aux organisations de creer des portails cartographiques multi-instances avec des donnees provenant d'OSM, d'uploads utilisateur (GeoJSON, Shapefile, GeoPackage, KML) et d'imagerie raster.

La plateforme couvre le cycle de vie complet des donnees geographiques : import (OSM via osm2pgsql, fichiers vectoriels via ogr2ogr), stockage (PostGIS), stylisation (SLD/Mapbox GL), visualisation (WMS/WFS via QGIS Server), edition de features, analyse spatiale, export multi-format et partage.

Ce depot contient l'**API REST backend** construite avec Fastify 5, suivant les principes de la **Clean Architecture** (Architecture Hexagonale).

---

## Stack technique

| Categorie | Technologie |
|---|---|
| Runtime | Node.js 22+ |
| Langage | TypeScript 5.7 (mode strict) |
| Framework | Fastify 5 |
| Base de donnees | PostgreSQL 16 + PostGIS 3.4 |
| ORM | Prisma 6 |
| Cache / File d'attente | Redis 7+ / BullMQ 5 |
| Authentification | JWT (access + refresh tokens), Argon2id |
| Stockage objet | MinIO (compatible S3) |
| Recherche | MeiliSearch v1.6 |
| Serveur cartographique | QGIS Server 3.28 |
| Outils geospatiaux | GDAL/ogr2ogr, osm2pgsql |
| Scripts serveur carto | PyQGIS (Python 3) |
| Geocodage | Nominatim |
| Itineraire | OSRM |
| Observabilite | Winston (logs), Prometheus (metriques), OpenTelemetry/Jaeger (traces), Graylog/GELF (centralisation), AlertingService (Slack + email) |
| Validation | Zod |
| Injection de dependances | Awilix (166+ composants) |
| WebSocket | @fastify/websocket |
| Documentation API | Swagger / Swagger UI |
| Tests | Vitest (800+ tests unitaires et d'integration) |
| CI/CD | GitHub Actions (CI, qualite, securite, deploiement automatique) |
| Conteneurisation | Docker + Docker Compose |

---

## Demarrage rapide (test en local)

### Option 1 : Avec Docker Compose (recommande)

C'est la methode la plus simple pour tester l'application avec tous ses services.

```bash
# 1. Cloner le depot
git clone https://github.com/GeOsmFamily/geosm-api-refactor.git
cd geosm-api-refactor

# 2. Configurer l'environnement
cp .env.example .env

# 3. Demarrer tous les services (API + PostgreSQL + Redis + MinIO + MeiliSearch + QGIS Server)
docker compose up -d

# 4. Verifier que tous les services sont en bonne sante
docker compose ps

# 5. Executer les migrations de la base de donnees
docker compose exec api npx prisma migrate deploy --schema=src/infrastructure/database/prisma/schema.prisma

# 6. Initialiser la base (creer le super administrateur)
docker compose exec api npm run db:seed

# 7. Verifier que l'API fonctionne
curl http://localhost:3000/health
```

L'API est accessible sur `http://localhost:3000`. La documentation Swagger est sur `http://localhost:3000/docs`.

### Option 2 : En mode developpement (sans Docker pour l'API)

Pour developper avec hot-reload, vous pouvez lancer les services de support via Docker et l'API en local.

```bash
# 1. Cloner et installer les dependances
git clone https://github.com/GeOsmFamily/geosm-api-refactor.git
cd geosm-api-refactor
npm install

# 2. Configurer l'environnement
cp .env.example .env
# Modifier .env : remplacer les noms d'hotes Docker par localhost
# DATABASE_URL=postgresql://geosm:geosm_secret@localhost:5432/geosm?schema=public
# REDIS_HOST=localhost
# MINIO_ENDPOINT=localhost
# MEILISEARCH_HOST=http://localhost:7700

# 3. Demarrer les services de support (sans l'API)
docker compose up -d postgres redis minio meilisearch

# 4. Generer le client Prisma
npm run db:generate

# 5. Executer les migrations
npm run db:migrate

# 6. Initialiser la base
npm run db:seed

# 7. Demarrer l'API en mode developpement (hot-reload)
npm run dev
```

### Premiere connexion

Une fois l'API demarree :

```bash
# 1. Se connecter avec le super admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@geosm.org","password":"AdminP@ssw0rd!"}'

# 2. Copier l'accessToken de la reponse et l'utiliser pour les requetes suivantes
export TOKEN="votre_access_token_ici"

# 3. Verifier la sante detaillee (PostgreSQL, Redis, MinIO, MeiliSearch)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/health/detailed

# 4. Consulter la documentation Swagger
# Ouvrir http://localhost:3000/docs dans un navigateur
```

### URLs des services

| Service | URL | Description |
|---|---|---|
| API GeOSM | http://localhost:3000 | API REST principale |
| Swagger UI | http://localhost:3000/docs | Documentation interactive |
| Metriques Prometheus | http://localhost:3000/metrics | Metriques de l'API |
| Console MinIO | http://localhost:9001 | Interface de gestion MinIO (minioadmin/minioadmin) |
| Grafana | http://localhost:3001 | Tableaux de bord (admin/admin) |
| Prometheus | http://localhost:9090 | Metriques et alertes |
| Jaeger UI | http://localhost:16686 | Traces distribuees |
| Graylog | http://localhost:9009 | Centralisation des logs |

### Stack de monitoring (optionnel)

Pour activer la stack de monitoring complete :

```bash
# Demarrer tous les services y compris monitoring
docker compose up -d

# Ou demarrer uniquement les services de monitoring
docker compose up -d grafana prometheus jaeger graylog mongodb opensearch
```

---

## Tests

```bash
# Lancer tous les tests unitaires
npm test

# Lancer les tests en mode watch
npm run test:watch

# Lancer les tests avec couverture de code
npm run test:coverage

# Lancer les tests d'integration (necessite PostgreSQL, Redis, MinIO, MeiliSearch)
npm run test:integration
```

Le projet contient **800+ tests** repartis en :
- **~494 tests unitaires** : cas d'utilisation, services, validations
- **314 tests d'integration** : PostGIS (32), Adressage (12), OSM (12), Boot applicatif (4), Validation SQL (4), Conteneur DI (166), Services externes (13), Depots Prisma (13), Observabilite (43), Charge (1), Scripts QGIS (14)

---

## Prerequis

- **Node.js** 22+
- **PostgreSQL** 16 avec l'extension **PostGIS** 3.4
- **Redis** 7+
- **MinIO** (stockage objet compatible S3)
- **MeiliSearch** (moteur de recherche full-text)
- **QGIS Server** 3.28+ (services OGC WMS/WFS)
- **GDAL** avec `ogr2ogr` en ligne de commande (conversion de donnees spatiales)
- **Python 3** avec les bindings PyQGIS (scripts de gestion de projets QGIS)
- **osm2pgsql** (import de donnees OpenStreetMap)

---

## Variables d'environnement

Toutes les variables sont validees au demarrage avec Zod. Les variables sans valeur par defaut sont **obligatoires**.

### Application

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `NODE_ENV` | Environnement (`development`, `production`, `test`) | `development` | Non |
| `PORT` | Port du serveur | `3000` | Non |
| `HOST` | Hote du serveur | `0.0.0.0` | Non |
| `API_PREFIX` | Prefixe des routes API | `/api/v1` | Non |
| `APP_NAME` | Nom de l'application | `GeOSM API` | Non |
| `APP_URL` | URL publique de l'application | `http://localhost:3000` | Non |

### Base de donnees

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `DATABASE_URL` | Chaine de connexion PostgreSQL (avec PostGIS) | -- | **Oui** |

### Redis

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `REDIS_HOST` | Hote Redis | `localhost` | Non |
| `REDIS_PORT` | Port Redis | `6379` | Non |
| `REDIS_PASSWORD` | Mot de passe Redis | `""` | Non |

### Authentification JWT

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | Secret pour signer les access tokens | -- | **Oui** |
| `JWT_REFRESH_SECRET` | Secret pour signer les refresh tokens | -- | **Oui** |
| `JWT_ACCESS_EXPIRATION` | Duree de vie de l'access token | `15m` | Non |
| `JWT_REFRESH_EXPIRATION` | Duree de vie du refresh token | `7d` | Non |

### Hachage Argon2

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `ARGON2_MEMORY_COST` | Cout memoire (KiB) | `65536` | Non |
| `ARGON2_TIME_COST` | Nombre d'iterations | `3` | Non |
| `ARGON2_PARALLELISM` | Facteur de parallelisme | `4` | Non |

### Limitation de debit

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `RATE_LIMIT_PUBLIC` | Limite pour les endpoints publics (req/fenetre) | `10` | Non |
| `RATE_LIMIT_AUTHENTICATED` | Limite pour les endpoints authentifies | `100` | Non |
| `RATE_LIMIT_ADMIN` | Limite pour les endpoints admin | `1000` | Non |
| `RATE_LIMIT_WINDOW_MS` | Fenetre de limitation en millisecondes | `60000` | Non |

### Email SMTP

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `SMTP_HOST` | Hote du serveur SMTP | `localhost` | Non |
| `SMTP_PORT` | Port du serveur SMTP | `587` | Non |
| `SMTP_USER` | Nom d'utilisateur SMTP | `""` | Non |
| `SMTP_PASS` | Mot de passe SMTP | `""` | Non |
| `SMTP_FROM` | Adresse d'envoi par defaut | `noreply@geosm.org` | Non |

### MinIO (stockage objet)

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `MINIO_ENDPOINT` | Endpoint du serveur MinIO | `localhost` | Non |
| `MINIO_PORT` | Port du serveur MinIO | `9000` | Non |
| `MINIO_ACCESS_KEY` | Cle d'acces MinIO | `minio_access` | Non |
| `MINIO_SECRET_KEY` | Cle secrete MinIO | `minio_secret` | Non |
| `MINIO_BUCKET` | Nom du bucket MinIO | `geosm` | Non |
| `MINIO_USE_SSL` | Activer SSL pour MinIO | `false` | Non |

### MeiliSearch

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `MEILISEARCH_HOST` | URL du serveur MeiliSearch | `http://localhost:7700` | Non |
| `MEILISEARCH_API_KEY` | Cle API MeiliSearch | `masterKey` | Non |

### Services geospatiaux

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `QGIS_SERVER_URL` | URL du endpoint OWS de QGIS Server | `http://localhost:8380/ows` | Non |
| `QGIS_PROJECTS_DIR` | Repertoire des fichiers de projets QGIS | `/var/www/qgis/projects` | Non |
| `QGIS_STYLES_DIR` | Repertoire des fichiers de styles QGIS | `/var/www/qgis/styles` | Non |
| `DATA_DIR` | Repertoire temporaire de donnees | `/tmp/geosm-data` | Non |
| `NOMINATIM_URL` | URL du service de geocodage Nominatim | `http://localhost:8081` | Non |
| `OSRM_URL` | URL du service de routage OSRM | `http://localhost:5000` | Non |

### Observabilite

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `LOG_LEVEL` | Niveau de log (debug, info, warn, error) | `info` | Non |
| `PROMETHEUS_ENABLED` | Activer l'endpoint de metriques Prometheus | `true` | Non |
| `GRAYLOG_HOST` | Hote Graylog pour les logs GELF | `""` | Non |
| `GRAYLOG_PORT` | Port Graylog GELF (UDP) | `12201` | Non |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint OpenTelemetry pour Jaeger | `""` | Non |
| `OTEL_SERVICE_NAME` | Nom du service pour les traces | `geosm-api` | Non |
| `SLACK_WEBHOOK_URL` | Webhook Slack pour les alertes | `""` | Non |
| `ALERT_EMAIL_TO` | Email destinataire des alertes | `""` | Non |

### Super administrateur

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `SUPER_ADMIN_EMAIL` | Email du super admin (utilise par le seed) | `admin@geosm.org` | Non |
| `SUPER_ADMIN_PASSWORD` | Mot de passe du super admin (utilise par le seed) | `AdminP@ssw0rd!` | Non |
| `SUPER_ADMIN_FIRST_NAME` | Prenom du super admin | `Super` | Non |
| `SUPER_ADMIN_LAST_NAME` | Nom du super admin | `Admin` | Non |

### CORS

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `CORS_ORIGIN` | Origine CORS autorisee | `http://localhost:4200` | Non |

---

## Architecture

Ce projet suit les principes de la **Clean Architecture** (Architecture Hexagonale). Les dependances pointent vers l'interieur.

```
+---------------------------------------------------------+
|                 Couche Presentation                      |
|  Routes  |  Middleware  |  Plugins  |  Schemas (Zod)     |
+----------------------------------------------------------+
|                 Couche Application                       |
|  Cas d'utilisation  |  DTOs  |  Interfaces de services   |
+----------------------------------------------------------+
|                   Couche Domaine                         |
|  Entites  |  Enums  |  Erreurs  |  Interfaces de depots  |
+----------------------------------------------------------+
|                Couche Infrastructure                     |
|  Prisma  |  Redis  |  MinIO  |  BullMQ  |  GDAL          |
|  WebSocket  |  APIs externes  |  QGIS  |  Email  |  OSM  |
+----------------------------------------------------------+
```

Pour plus de details, voir [docs/architecture.md](./docs/architecture.md).

---

## Endpoints API

L'API est servie sous le prefixe `/api/v1`. La documentation interactive Swagger est disponible sur `/docs`.

### Sante et metriques
- `GET /health` -- Verification de sante
- `GET /health/detailed` -- Sante detaillee (PostgreSQL, Redis, MinIO, MeiliSearch, QGIS, disque, memoire)
- `GET /health/ready` -- Sonde de disponibilite (Kubernetes readinessProbe)
- `GET /health/live` -- Sonde de vivacite (Kubernetes livenessProbe)
- `GET /metrics` -- Metriques Prometheus (25+ compteurs/histogrammes/jauges)

### Authentification (`/api/v1/auth`)
- Inscription, connexion, rafraichissement de token, deconnexion
- Verification d'email, mot de passe oublie, reinitialisation
- Profil utilisateur (consultation et mise a jour)

### Utilisateurs (`/api/v1/users`) -- Super Admin uniquement
- CRUD complet + changement de role + activation/desactivation

### Instances (`/api/v1/instances`)
- CRUD + gestion des utilisateurs par instance

### Groupes (`/api/v1/instances/:instanceId/groups`)
- CRUD + reordonnancement

### Sous-groupes (`/api/v1/groups/:groupId/sub-groups`)
- CRUD complet

### Couches (`/api/v1/instances/:instanceId/layers`)
- CRUD + import de donnees + statistiques

### Features (`/api/v1/layers/:layerId/features`)
- CRUD des entites geographiques avec filtres spatiaux

### Styles (`/api/v1/layers/:layerId/style`)
- Consultation/mise a jour SLD et Mapbox GL, reinitialisation

### Fonds de carte (`/api/v1/instances/:instanceId/base-maps`)
- CRUD des fonds de carte (XYZ, WMS, WMTS, Mapbox)

### Exports (`/api/v1/exports`)
- Creation, liste, detail, telechargement, suppression

### Geocodage (`/api/v1/geocode`)
- Recherche, geocodage inverse, lookup par ID OSM

### Itineraire (`/api/v1/routing`)
- Calcul d'itineraire, point le plus proche

### Recherche (`/api/v1/search`)
- Recherche globale, par couches, par features

### Projets QGIS (`/api/v1/instances/:instanceId/qgis-project`)
- Consultation et rechargement

### Proxy WMS/WFS
- `GET /api/v1/wms` -- Proxy WMS vers QGIS Server
- `GET /api/v1/wfs` -- Proxy WFS vers QGIS Server

### OSM (`/api/v1/osm`)
- Requete de donnees OSM, creation de tables PostGIS a partir de tags OSM

### Themes par defaut (`/api/v1/default-themes`)
- CRUD + tags + initialisation

### Geoportail (`/api/v1/geoportail`)
- Altitude, profil altimetrique, limites administratives, geolocalisation IP

### Dessins (`/api/v1/drawings`)
- Sauvegarde et gestion de dessins GeoJSON

### Partage (`/api/v1/share`)
- Creation et consultation de cartes partagees

### Analytiques (`/api/v1/analytics`)
- Suivi d'evenements, compteur de vues, consultation des donnees

### Catalogue (`/api/v1/catalog`)
- Catalogue complet des donnees par instance

### Compositions de carte (`/api/v1/instances/:instanceId/maps`)
- CRUD des compositions de carte sauvegardees

### Documents (`/api/v1/documents`)
- Upload, liste, consultation, suppression

### SEO (`/api/v1/seo`)
- Metadonnees SEO par instance

### Adressage (`/api/v1/adressage`)
- Operations d'adressage (recherche, position, points)

### Analyse spatiale (`/api/v1/analysis`)
- Analyse spatiale (buffer, intersection, etc.)

### Rasters (`/api/v1/rasters`)
- Upload et telechargement de donnees raster

### Administration (`/api/v1/admin`) -- Super Admin uniquement
- Tableau de bord, gestion des jobs, import OSM, cache, sante systeme

### WebSocket (`/ws/notifications`)
- Notifications en temps reel (progression import/export)

Pour la reference API complete, voir [docs/reference-api.md](./docs/reference-api.md).

---

## CI/CD

Le projet dispose d'un pipeline CI/CD complet via GitHub Actions :

| Workflow | Declencheur | Description |
|---|---|---|
| **CI** | push/PR sur main, dev | Linting, TypeScript, tests unitaires avec couverture, tests d'integration (PostgreSQL, Redis, MinIO, MeiliSearch), build |
| **Qualite du code** | push/PR sur main, dev | ESLint detaille, verification TypeScript, couverture de code, detection de code duplique (jscpd) |
| **Securite** | push/PR + hebdomadaire | Audit npm, detection de secrets (Gitleaks), analyse SAST, scan Docker (Trivy), verification d'injection SQL |
| **Deploiement** | push sur main | Tests, build Docker, push GHCR, creation de tag `yyyyMMdd.numBuild`, release GitHub |
| **Labels** | manuel | Initialisation de 30+ labels du projet en francais |

### Dependabot

Dependabot est configure pour verifier hebdomadairement (lundi 8h, fuseau Africa/Douala) les mises a jour de :
- **npm** : dependances Node.js (groupees par categorie : Prisma, Fastify, OpenTelemetry, etc.)
- **Docker** : images du Dockerfile
- **GitHub Actions** : actions utilisees dans les workflows

Les PRs de Dependabot ciblent la branche `dev`.

### Versionnement

Les versions suivent le format `yyyyMMdd.numBuild` (ex: `20260626.1`, `20260626.2`). Chaque push sur `main` cree automatiquement un tag Git et une release GitHub avec l'image Docker correspondante sur GHCR.

---

## Schema de base de donnees

La base de donnees utilise PostgreSQL avec les extensions PostGIS. Elle contient **19 modeles Prisma** :

| Modele | Description |
|---|---|
| `User` | Utilisateurs avec roles (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR, VIEWER) |
| `RefreshToken` | Tokens de rafraichissement avec rotation par famille |
| `Instance` | Instance geoportail (pays/region) avec bbox, centre, zoom |
| `InstanceUser` | Association utilisateur-instance avec role par instance |
| `Group` | Groupe thematique de couches au sein d'une instance |
| `SubGroup` | Sous-categorie au sein d'un groupe |
| `Layer` | Couche cartographique avec type de geometrie, source, table spatiale |
| `LayerStyle` | Styles SLD ou Mapbox GL attaches a une couche |
| `LayerAction` | Actions configurables par couche (telechargement, partage, impression, mesure, itineraire, commentaire) |
| `QgisProject` | Reference a un fichier de projet QGIS pour le service WMS/WFS |
| `BaseMap` | Fonds de carte (XYZ, WMS, WMTS, Mapbox) |
| `Export` | Jobs d'export asynchrones (GeoJSON, Shapefile, GeoPackage, KML, CSV, PDF) |
| `DefaultTheme` | Categories thematiques OSM predefinies |
| `DefaultTag` | Tags OSM associes a un theme par defaut |
| `Drawing` | Dessins GeoJSON crees par les utilisateurs |
| `SharedMap` | Instantanes de carte partagees avec codes courts |
| `AnalyticsEvent` | Evenements de suivi d'utilisation |
| `MapComposition` | Compositions de carte sauvegardees avec selection de couches et viewport |
| `Document` | Fichiers attaches aux couches ou instances |

En plus des modeles Prisma, la base contient :
- **Tables spatiales dynamiques** : creees lors de l'import de donnees, referencees par `Layer.tableName` et `Layer.schemaName`
- **Tables OSM** : `planet_osm_point`, `planet_osm_line`, `planet_osm_polygon`, `planet_osm_roads` (creees par osm2pgsql)

---

## Observabilite

L'API integre une stack d'observabilite complete :

| Composant | Technologie | Description |
|---|---|---|
| **Metriques** | Prometheus (prom-client) | 25+ metriques custom : HTTP, WebSocket, jobs, DB, PostGIS, ogr2ogr, stockage, recherche, cache, QGIS, auth, email |
| **Traces** | OpenTelemetry + Jaeger | Traces distribuees via OTLP/HTTP |
| **Logs** | Winston + Graylog (GELF) | Logs structures avec transport GELF pour centralisation |
| **Alertes** | AlertingService | Alertes via webhook Slack et email SMTP (erreurs, latence, disque, memoire) |
| **Tableaux de bord** | Grafana | Dashboards preconfigures pour l'API |

---

## Scripts PyQGIS

Situes dans `python_scripts/`, ces 14 scripts gerent les projets QGIS Server :

| Script | Description |
|---|---|
| `add_vector_layer.py` | Ajouter une couche vectorielle PostGIS a un projet QGIS |
| `add_raster_layer.py` | Ajouter une couche raster a un projet QGIS |
| `remove_layer.py` | Supprimer une couche d'un projet QGIS |
| `save_style.py` | Sauvegarder un style de couche (SLD) dans le projet |
| `set_style.py` | Appliquer un style a une couche |
| `set_icon_on_layer.py` | Definir une icone sur une couche |
| `reload_project.py` | Recharger un projet QGIS pour prendre en compte les modifications |
| `clip_export.py` | Exporter et decouper des donnees selon une emprise |
| `export_layer.py` | Exporter une couche dans un format specifique |
| `setup_wms_capabilities.py` | Configurer les capacites WMS d'un projet |
| `configure_wfs.py` | Configurer les capacites WFS d'un projet |
| `get_layer_info.py` | Obtenir les informations d'une couche |
| `edit_layer_properties.py` | Modifier les proprietes d'une couche |
| `download_data.py` | Telecharger des donnees depuis une source |

Ces scripts necessitent Python 3 avec les bindings PyQGIS et sont invoques par l'API via des processus enfants.

---

## Structure du projet

```
src/
+-- server.ts                    # Point d'entree de l'application
+-- container.ts                 # Configuration du conteneur DI Awilix (166+ composants)
+-- config/                      # Configuration (environnement, application)
+-- domain/                      # Couche domaine (entites, enums, erreurs, interfaces)
+-- application/                 # Couche application
|   +-- dtos/                    # Objets de transfert de donnees
|   +-- services/                # Interfaces de services
|   +-- use-cases/               # Logique metier organisee par module (27 modules)
+-- infrastructure/              # Couche infrastructure
|   +-- auth/                    # Services Argon2, JWT
|   +-- cache/                   # Service Redis
|   +-- database/                # Depots Prisma, PostGIS, requetes OSM, adressage
|   |   +-- prisma/              # Schema et migrations
|   |   +-- repositories/        # Implementations Prisma des depots
|   +-- email/                   # Service SMTP
|   +-- external-apis/           # Nominatim, OSRM, MeiliSearch, QGIS Server
|   +-- gdal/                    # Service ogr2ogr, service raster
|   +-- observability/           # Metriques Prometheus, traces OpenTelemetry, logs Winston/GELF, alertes
|   +-- osm/                     # Service osm2pgsql
|   +-- qgis/                    # Service de gestion de projets QGIS
|   +-- queue/                   # Service de file d'attente BullMQ et workers
|   +-- storage/                 # Service de stockage MinIO
|   +-- utils/                   # Utilitaires (generateur SVG)
|   +-- websocket/               # Service de notifications WebSocket
+-- presentation/                # Couche presentation (HTTP)
    +-- middleware/               # Gestionnaire d'erreurs, RBAC, logger, metriques Prometheus
    +-- plugins/                  # Plugins Fastify (auth, CORS, Swagger, WebSocket, multipart)
    +-- routes/                   # Gestionnaires de routes (31 modules)
    +-- schemas/                  # Schemas de validation Zod

python_scripts/                  # Scripts PyQGIS pour la gestion des projets QGIS
tests/                           # Tests d'integration
  +-- integration-db/            # Tests avec base de donnees reelle
monitoring/                      # Configuration Grafana et Prometheus
docker/                          # Scripts Docker (entrypoint)
.github/                         # CI/CD, templates d'issues/PR, Dependabot
```

---

## Contribution

Consultez [CONTRIBUTING.md](./CONTRIBUTING.md) pour les directives de contribution a ce projet.

---

## Licence

Ce projet est sous licence MIT. Voir [LICENSE](./LICENSE) pour les details.

Copyright (c) 2024-2026 GeOSM Family
