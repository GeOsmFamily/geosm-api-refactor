# Guide de deploiement GeOSM (production)

Checklist etape par etape pour deployer GeOSM sur un VPS vierge, du serveur nu jusqu'a
l'application fonctionnelle. Si une etape manque ici pour reussir un deploiement reel, c'est un
bug de ce document, pas juste une note manquante.

---

## Architecture des services

Le deploiement complet comprend **15 services** (2 applicatifs + 13 d'infrastructure/observabilite) :

### Services applicatifs

| Service | Image | Port (prod, localhost uniquement sauf frontend) | Role |
|---|---|---|---|
| **frontend** | `ghcr.io/geosmfamily/geosm-frontend-refactor:<tag>` | 80 (public) | Angular + nginx, reverse proxy public de toute la stack |
| **api** | `ghcr.io/geosmfamily/geosm-api-refactor:<tag>` | 3005 | API GeOSM (Fastify 5) |

### Donnees et recherche

| Service | Image | Port | Role |
|---|---|---|---|
| **postgres** | `postgis/postgis:16-3.4` | 5432 | Base de donnees PostgreSQL + PostGIS |
| **redis** | `redis:7-alpine` | 6379 | Cache + backend BullMQ |
| **minio** | `minio/minio:RELEASE.2024-01-16` | 9000, 9001 | Stockage objet (S3) - exports, documents, sauvegardes |
| **meilisearch** | `getmeili/meilisearch:v1.6` | 7700 | Moteur de recherche full-text |
| **qgis-server** | `camptocamp/qgis-server:3.28` | 8380 | Serveur cartographique WMS/WFS |

### Geocodage et itineraires (auto-heberges, Lot P9)

| Service | Image | Port | Role |
|---|---|---|---|
| **nominatim** | `mediagis/nominatim:4.5` | 8081 | Geocodage direct/inverse - remplace le serveur public de demo |
| **osrm** | `osrm/osrm-backend` | 5000 | Calcul d'itineraires routiers - remplace le serveur public de demo |

> En developpement, `NOMINATIM_URL`/`OSRM_URL` pointent encore sur les serveurs publics
> (`nominatim.openstreetmap.org`, `router.project-osrm.org`). Leurs politiques d'usage ("light
> testing only", 1 requete/seconde) ne supportent pas un trafic de production - voir
> [Auto-hebergement Nominatim et OSRM](#auto-hebergement-nominatim-et-osrm) plus bas.

### Stack d'observabilite

| Service | Image | Port | Role |
|---|---|---|---|
| **grafana** | `grafana/grafana:10.2.0` | 3001 | Tableaux de bord et visualisation |
| **prometheus** | `prom/prometheus:v2.48.0` | 9090 | Collecte de metriques |
| **jaeger** | `jaegertracing/all-in-one:1.52` | 16686, 4318 | Tracing distribue (OpenTelemetry) |
| **graylog** | `graylog/graylog:5.2` | 9009, 12201/udp | Gestion centralisee des logs (GELF) |
| **mongodb** | `mongo:6.0` | -- | Backend Graylog |
| **opensearch** | `opensearchproject/opensearch:2.11.0` | -- | Indexation des logs (Graylog) |

Tous les ports de la colonne "Port" sont lies a `127.0.0.1` en production
(`docker-compose.prod.yml`) - seul `frontend` (80) est joignable depuis l'exterieur. Le
frontend sert de reverse proxy public vers l'API (`/api/` -> `api:3000`) et QGIS Server
(`/ows` -> `qgis-server:8080`) sur le reseau Docker interne.

---

## 1. Prerequis

- Un VPS avec au moins **4 vCPU et 8 Go de RAM** (Nominatim et OSRM sont plus gourmands que le
  reste de la stack - voir leurs limites de ressources dans `docker-compose.prod.yml`)
- **40 Go d'espace disque** minimum (extract OSM regional + import Nominatim + volumes Postgres/MinIO)
- Docker 24+ et Docker Compose v2+ installes
- Un nom de domaine pointant vers l'IP du VPS (enregistrement DNS `A`)
- Acces SSH avec une cle dediee au deploiement (voir [CI/CD](#4-cicd-et-deploiement-continu))

## 2. Provisionner le VPS

```bash
# Sur le VPS (Ubuntu/Debian) :
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Se reconnecter pour que le groupe docker s'applique

# Creer un utilisateur dedie au deploiement (utilise par la cle SSH de CI/CD, voir plus bas)
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
```

## 3. Cloner le depot backend sur le VPS

Seul le depot **backend** doit etre clone sur le serveur : `docker-compose.yml` et
`docker-compose.prod.yml` y vivent, et referencent les images Docker des deux depots (deja
publiees sur GHCR par leurs pipelines CI respectifs) - le depot frontend n'a pas besoin d'etre
clone separement.

```bash
sudo -u deploy -i
git clone https://github.com/GeOsmFamily/geosm-api-refactor.git /opt/geosm
cd /opt/geosm
```

## 4. Generer et renseigner tous les secrets

```bash
cp .env.example .env
```

**Ne jamais reutiliser les valeurs de developpement** (`change-me-...`, `geosm_secret`,
`minioadmin`, etc.) en production - voir la section dediee
[Rotation des secrets](#rotation-des-secrets) pour la procedure complete de generation. Variables
a renseigner avant le premier demarrage :

```bash
# Application
NODE_ENV=production
APP_URL=https://api.votre-domaine.org
CORS_ORIGIN=https://votre-domaine.org

# Base de donnees
DATABASE_URL=postgresql://geosm:<MOT_DE_PASSE_GENERE>@postgres:5432/geosm?schema=public
POSTGRES_PASSWORD=<MOT_DE_PASSE_GENERE>

# JWT (RS256) - un secret different pour l'access et le refresh token
JWT_ACCESS_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>

# Chiffrement du token OAuth OpenStreetMap au repos (AES-256-GCM, Lot P1)
ENCRYPTION_KEY=<openssl rand -hex 32>

# MinIO, MeiliSearch, Redis
MINIO_ACCESS_KEY=<genere>
MINIO_SECRET_KEY=<genere>
MEILISEARCH_API_KEY=<genere>
REDIS_PASSWORD=<genere>

# Super admin (a changer immediatement apres la premiere connexion, voir rotation des secrets)
SUPER_ADMIN_EMAIL=admin@votre-domaine.org
SUPER_ADMIN_PASSWORD=<genere>

# SMTP (obligatoire pour la verification d'email et la reinitialisation de mot de passe)
SMTP_HOST=smtp.votre-provider.com
SMTP_PORT=587
SMTP_USER=votre-utilisateur
SMTP_PASS=<mot de passe fourni par le provider SMTP>
SMTP_FROM=noreply@votre-domaine.org

# Authentification OpenStreetMap (Lot P1) - app OAuth2 a enregistrer sur www.openstreetmap.org
# (Parametres du compte -> OAuth 2 applications -> Enregistrer une nouvelle application),
# scope read_prefs, redirect URI exacte : https://api.votre-domaine.org/api/v1/auth/osm/callback
OSM_OAUTH_CLIENT_ID=<fourni par osm.org>
OSM_OAUTH_CLIENT_SECRET=<fourni par osm.org>
OSM_OAUTH_REDIRECT_URI=https://api.votre-domaine.org/api/v1/auth/osm/callback
OSM_OAUTH_BASE_URL=https://www.openstreetmap.org

# Nominatim/OSRM auto-heberges (Lot P9) - voir section dediee plus bas
NOMINATIM_URL=http://nominatim:8080
OSRM_URL=http://osrm:5000
NOMINATIM_DB_PASSWORD=<genere - postgres interne au conteneur nominatim, sans rapport avec DATABASE_URL>

# Alerting (Slack et/ou email, utilise par le formulaire de signalement et les jobs critiques)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_EMAIL_TO=oncall@votre-domaine.org

# Cle Gemini (assistant IA) - a generer sur https://aistudio.google.com
GEMINI_API_KEY=<votre cle>
```

## 5. Auto-hebergement Nominatim et OSRM

Les deux services sont deja definis dans `docker-compose.prod.yml`, mais chacun a besoin de
donnees pretes **avant** son premier demarrage.

### Nominatim

Telecharger l'extract regional (Cameroun, ou le pays cible de l'instance) et le deposer dans
`./nominatim-source/region-latest.osm.pbf` :

```bash
mkdir -p nominatim-source
curl -L -o nominatim-source/region-latest.osm.pbf \
  https://download.geofabrik.de/africa/cameroon-latest.osm.pbf
```

Le premier demarrage du conteneur `nominatim` lance automatiquement l'import complet (compter
**15 a 45 minutes** pour un extract pays selon les ressources du VPS) ; les demarrages suivants
reutilisent les donnees deja importees dans le volume `nominatim-data`, sans reimporter. Suivre
la progression :

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f nominatim
```

Mise a jour des donnees (nouvel extract mensuel par exemple) : remplacer le fichier dans
`nominatim-source/`, puis `docker compose ... up -d --force-recreate nominatim` declenche un
reimport complet (pas de mise a jour incrementale configuree par defaut - `REPLICATION_URL` est
fourni dans la config pour qui souhaite passer a des mises a jour differentielles via
`nominatim replication`, plus econome mais plus complexe a operer).

### OSRM

Contrairement a Nominatim, `osrm-routed` ne sait que **servir** un jeu de donnees deja pret - la
preparation (extraction du reseau routier + partitionnement, necessaires pour l'algorithme MLD)
se fait a part, via le script fourni :

```bash
PBF_PATH=nominatim-source/region-latest.osm.pbf ./scripts/setup-osrm-data.sh
```

Ce script reutilise le meme fichier `.osm.pbf` que Nominatim (le reseau routier OSM est le meme
jeu de donnees), et produit les fichiers `region-latest.osrm*` dans `./osrm-data/`, montes en
lecture seule par le service `osrm`. A relancer manuellement apres chaque mise a jour
significative du reseau routier (bien plus rare qu'une mise a jour des couches thematiques - pas
de cron par defaut).

### Verification post-import

```bash
# Nominatim : recherche d'une adresse connue
curl "http://localhost:8081/search?q=Yaound%C3%A9&format=json&countrycodes=cm"

# OSRM : itineraire entre deux points du Cameroun
curl "http://localhost:5000/route/v1/driving/11.5021,3.8480;9.7043,4.0511"
```

### Limites administratives (admin_boundaries)

Table de reference `public.admin_boundaries` (id, name, admin_level, geom MultiPolygon) utilisee
par le selecteur de limite administrative de l'admin (`Instance.boundaryTable`/`boundaryId`, voir
`FindAdminBoundaryUseCase`/`SearchBoundariesUseCase`/`CreateOsmTableUseCase`) - **pas geree par
Prisma** (modele `@@ignore` dans `schema.prisma`, pour eviter que `prisma db push`, execute a
chaque demarrage du conteneur, ne refuse de demarrer a cause de cette table "non geree").

Deux facons de la peupler :

1. **Pre-remplissage initial** via le meme extract `.osm.pbf` que Nominatim/OSRM ci-dessus
   (reutilise le pilote OSM de GDAL pour extraire les polygones `boundary=administrative`) :
   ```bash
   PBF_PATH=nominatim-source/region-latest.osm.pbf \
     DATABASE_URL="$DATABASE_URL" \
     ./scripts/seed-admin-boundaries.sh
   ```
   Idempotent au niveau de la creation de table (`CREATE TABLE IF NOT EXISTS`), mais **ajoute**
   les lignes a chaque execution sans supprimer les anciennes - ne pas relancer sans y penser sur
   une base deja peuplee (voir l'option "remplacer ce niveau" ci-dessous pour un remplacement
   cible par niveau administratif).
2. **Import ponctuel via l'interface admin** (`POST /geoportail/admin-boundaries/import`,
   reserve `SUPER_ADMIN`) : shapefile (`.zip`) ou GeoJSON, avec un champ source a mapper vers
   `name` et un niveau administratif a assigner a tout le fichier (un fichier = un seul niveau,
   comme les exports GADM par niveau) - mode "ajouter" ou "remplacer ce niveau". Accessible depuis
   le selecteur de limite administrative du formulaire de creation/edition d'instance.

## 6. Reverse proxy et SSL

Le service `frontend` (nginx) est deja le reverse proxy applicatif (relaie `/api/` vers `api`,
`/ows` vers `qgis-server`). Il manque uniquement la couche TLS publique. Deux options :

### Option A - Caddy devant le port 80 du frontend (le plus simple, TLS automatique)

```
# Caddyfile
votre-domaine.org {
    reverse_proxy localhost:80
}
```

### Option B - Nginx + Certbot

```nginx
server {
    listen 80;
    server_name votre-domaine.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.org;

    ssl_certificate /etc/letsencrypt/live/votre-domaine.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.org
sudo certbot renew --dry-run
```

## 7. Demarrer la stack complete

```bash
cd /opt/geosm
export API_IMAGE=ghcr.io/geosmfamily/geosm-api-refactor:latest
export FRONTEND_IMAGE=ghcr.io/geosmfamily/geosm-frontend-refactor:latest

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Suivre le demarrage (Nominatim prend le plus de temps au premier lancement, voir section 5)
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
```

## 8. Initialiser la base de donnees

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api npm run db:seed

# Bucket MinIO (si pas deja cree par le seed)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec minio \
  mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec minio mc mb local/geosm
```

Puis, via l'API (voir `docs/reference-api.md`) :

1. Se connecter avec le compte super admin : `POST /api/v1/auth/login`
2. Creer la premiere instance (pays) : `POST /api/v1/instances`
3. Initialiser les themes par defaut : `POST /api/v1/default-themes/seed`
4. Importer les donnees OSM applicatives (couches thematiques, distinct de l'import Nominatim
   ci-dessus) : `POST /api/v1/admin/osm/import`

## 9. Checklist de verification post-deploiement

- [ ] `curl https://votre-domaine.org/api/v1/health` -> `200`, tous les services `"status":"up"`
- [ ] `https://votre-domaine.org` charge la carte, le selecteur d'instance liste le(s) pays cree(s)
- [ ] Connexion (email/mot de passe) et connexion OpenStreetMap fonctionnent toutes les deux
- [ ] Une recherche geographique (barre de recherche) renvoie un resultat via Nominatim auto-heberge
- [ ] Un calcul d'itineraire renvoie un trace via OSRM auto-heberge
- [ ] `POST /api/v1/admin/backup` declenche bien un backup visible dans MinIO (bucket `geosm`, prefixe `backups/`)
- [ ] Grafana (`:3001`, via tunnel SSH - non expose publiquement) affiche des metriques recentes
- [ ] Jaeger (`:16686`) affiche des traces recentes pour une requete Gemini/OSRM/Nominatim
- [ ] Un email de test (verification ou reinitialisation de mot de passe) arrive bien
- [ ] Le certificat TLS est valide (`https://` sans avertissement navigateur) et se renouvelle automatiquement

---

## Rotation des secrets

Toutes les valeurs de `.env.example` sont des placeholders de developpement
(`change-me-access-secret`, `geosm_secret`, `minioadmin`, `AdminP@ssw0rd!`...) - **aucune ne doit
survivre telle quelle en production**. Procedure a executer avant le premier lancement, puis a
repeter periodiquement (recommande : tous les 6 mois, ou immediatement en cas de suspicion de
fuite) :

| Secret | Generation recommandee | Impact d'une rotation |
|---|---|---|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -hex 64` | Deconnecte tous les utilisateurs (tokens existants invalides) - a faire hors heures de pointe |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | **Ne pas tourner sans migration** : rend illisibles les tokens OSM deja chiffres en base (voir note ci-dessous) |
| `POSTGRES_PASSWORD` / `DATABASE_URL` | `openssl rand -base64 32` | Necessite un redemarrage coordonne de `postgres` et `api` |
| `REDIS_PASSWORD` | `openssl rand -base64 32` | Redemarrage de `redis` et `api` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `openssl rand -hex 20` / `openssl rand -base64 32` | Regenerer aussi les URLs pre-signees actives si applicable |
| `MEILISEARCH_API_KEY` | `openssl rand -hex 32` | Redemarrage de `meilisearch` et `api` |
| `NOMINATIM_DB_PASSWORD` | `openssl rand -base64 32` | Interne au conteneur Nominatim uniquement, sans impact sur le reste |
| `SUPER_ADMIN_PASSWORD` | Gestionnaire de mots de passe, 20+ caracteres | Ne s'applique qu'au seed initial - changer le mot de passe du compte via l'API ensuite, pas en modifiant `.env` apres coup |
| `GRAFANA_PASSWORD` | `openssl rand -base64 24` | Changer aussi dans l'UI Grafana si deja modifie manuellement |
| `OSM_OAUTH_CLIENT_SECRET` | Regenere depuis les parametres de l'app OAuth sur osm.org | Invalide les connexions OSM en cours (rare, sessions courtes) |
| `GEMINI_API_KEY` | Regeneree depuis Google AI Studio | Aucun impact utilisateur, coupure de l'assistant IA le temps de la bascule |
| `DEPLOY_SSH_KEY` (secret GitHub Actions) | Nouvelle paire de cles dediee au deploiement | Mettre a jour `authorized_keys` sur le VPS avant de revoquer l'ancienne |

**Note importante sur `ENCRYPTION_KEY`** : contrairement aux autres secrets, ce n'est **pas**
une simple valeur de verification (comme un mot de passe hache) mais une cle de chiffrement
symetrique (AES-256-GCM) appliquee au token d'acces OAuth OpenStreetMap stocke en base
(`OsmProfile.accessTokenEncrypted`). La tourner sans plan de migration rend **irrecuperables**
tous les tokens deja chiffres - les utilisateurs concernes devraient relier leur compte OSM
(`DELETE` puis nouveau `GET /auth/osm/login`). Si une vraie rotation est necessaire (cle
compromise), prevoir un script de dechiffrement avec l'ancienne cle puis rechiffrement avec la
nouvelle avant de bascule `ENCRYPTION_KEY`, plutot qu'un simple remplacement de variable.

Apres toute rotation impliquant `api`, redemarrer uniquement ce service (les autres n'ont pas
besoin de couper leurs connexions existantes) :

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate api
```

---

## Monitoring

### Metriques Prometheus

L'API expose `GET /metrics` (`PROMETHEUS_ENABLED=true`) : duree des requetes HTTP, requetes
base de donnees (via l'extension Prisma d'instrumentation), connexions/echecs de login, envois
d'email, appels Gemini (latence/volume/erreurs), metriques Node.js standard.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'geosm-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
```

### Tracing (Jaeger)

Spans automatiques (HTTP, DNS, ioredis) et manuels (appels Gemini/OSRM/Nominatim, jobs BullMQ).
Interface : `http://localhost:16686` (tunnel SSH recommande, non expose publiquement).

### Logs (Graylog)

Logging Winston applique a l'ensemble des domaines de use-cases (auth, couches, commentaires,
assistant IA, geosignets, sauvegardes...), avec `requestId` de correlation. Niveau configurable
via `LOG_LEVEL` (recommande : `info` en production). Les erreurs frontend non gerees remontent
aussi via `POST /logs/frontend-error` (voir `GlobalErrorHandler` Angular).

### Alerting

- **Slack** : `SLACK_WEBHOOK_URL` - utilise pour les nouveaux signalements (formulaire "Infos")
  et les incidents critiques
- **Email** : `ALERT_EMAIL_TO` - reserve aux alertes de niveau critique

### Sondes de sante

| Endpoint | Usage |
|---|---|
| `GET /health` | Etat detaille (BD, Redis, Nominatim, OSRM, etc.) |
| `GET /health/ready` | Sonde de disponibilite |
| `GET /health/live` | Sonde de vivacite |

---

## Sauvegarde

La sauvegarde Postgres est **automatisee** (Lot P4) - il ne s'agit plus d'un script cron a
maintenir a la main comme dans les versions precedentes de ce document :

- Job planifie (BullMQ, cron configurable via `BACKUP_CRON`, defaut `0 3 * * *`) : dump complet
  (`pg_dump -Fc`) uploade vers MinIO (bucket `geosm`, prefixe `backups/`), retention glissante
  configurable via `BACKUP_RETENTION_DAYS` (defaut 30 jours, les backups plus anciens sont
  supprimes automatiquement)
- Backup manuel immediat (avant une operation risquee, ex. import OSM volumineux) :
  ```bash
  curl -X POST https://api.votre-domaine.org/api/v1/admin/backup \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
  ```
- **Restauration** (a tester au moins une fois en environnement de test avant le lancement reel -
  un backup jamais restaure n'est pas un backup fiable) :
  ```bash
  # Recuperer le dump depuis MinIO puis :
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
    pg_restore -U geosm -d geosm --clean < backup.dump
  ```

Les autres donnees (documents, exports, rasters, projets QGIS) vivent deja dans MinIO/les
volumes Docker `qgis-projects`/`qgis-styles` - une sauvegarde de volume classique reste
pertinente pour ceux-ci en complement :

```bash
docker run --rm -v geosm_qgis-projects:/data -v $(pwd):/backup \
  alpine tar czf /backup/qgis_projects_backup.tar.gz /data
```

---

## 4. CI/CD et deploiement continu

Le deploiement automatique est gere par GitHub Actions (`deploy.yml`, sur les deux depots -
backend et frontend, meme structure) :

1. **Tests** : suite complete (backend : vitest + seuil de couverture reel ; frontend : lint +
   `tsc --noEmit` + tests unitaires + suite E2E Playwright)
2. **Build Docker** : construction de l'image
3. **Push GHCR** : `ghcr.io/geosmfamily/geosm-api-refactor:<version>` /
   `ghcr.io/geosmfamily/geosm-frontend-refactor:<version>`, tag `<yyyyMMdd>.<numBuild>` + `latest`
4. **Deploiement SSH** (si active, voir ci-dessous) : pull de la nouvelle image sur le VPS,
   redemarrage du seul service concerne, verification du healthcheck (jusqu'a 60s), et **rollback
   automatique vers `:latest` precedent si le healthcheck echoue**
5. **Tag Git + release GitHub** avec changelog automatique

### Activer le deploiement continu

Sur **chacun des deux depots** (backend et frontend), dans Settings -> Secrets and variables ->
Actions :

**Secrets** :
- `DEPLOY_SSH_HOST` : IP ou domaine du VPS
- `DEPLOY_SSH_USER` : `deploy` (utilisateur cree a l'etape 2)
- `DEPLOY_SSH_KEY` : cle privee SSH dediee (voir [Rotation des secrets](#rotation-des-secrets))
- `DEPLOY_PATH` : `/opt/geosm` (chemin du depot backend clone sur le VPS - les deux workflows
  s'y referent, meme le workflow frontend, puisque c'est la que vivent les fichiers
  `docker-compose*.yml`)

**Variable de repository** :
- `DEPLOY_ENABLED` : `true` (tant que non definie, le job de deploiement reste un no-op - permet
  de merger le pipeline avant que le VPS soit pret)

Sans ces secrets, `build-and-push` et la creation de release continuent de fonctionner
normalement (image publiee sur GHCR a chaque merge sur `main`) - seul le deploiement SSH est
conditionnel.

---

## Mise a l'echelle

### API (sans etat, JWT + Redis)

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      replicas: 3
```

Avec un load balancer Nginx :

```nginx
upstream geosm_api {
    least_conn;
    server api_1:3000;
    server api_2:3000;
    server api_3:3000;
}
```

### PostgreSQL

- Connection pooling avec PgBouncer
- Replicas en lecture pour les requetes lourdes
- Ajuster `shared_buffers`, `work_mem`, `effective_cache_size`

### Redis

- `maxmemory 256mb` / `allkeys-lru` par defaut - augmenter selon la charge
- Redis Sentinel ou Cluster pour la haute disponibilite

### QGIS Server

- Plusieurs instances derriere un load balancer, volume `qgis-projects` partage en lecture seule

### Nominatim / OSRM

- Les deux sont read-heavy et sans etat applicatif propre (Nominatim a son propre Postgres
  interne, OSRM sert des fichiers statiques) : plusieurs replicas derriere un load balancer
  fonctionnent sans coordination particuliere, chaque replica pouvant avoir sa propre copie du
  volume de donnees

### Conseils generaux

- **PostGIS** : index spatiaux (GIST) sur toutes les colonnes geometriques
- **Redis** : cache des requetes frequentes (catalogue, themes)
- **MeiliSearch** : indexer uniquement les champs necessaires a la recherche
- **MinIO** : URLs pre-signees pour les telechargements directs
- **QGIS Server** : cache de tuiles WMS
