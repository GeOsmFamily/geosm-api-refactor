# Guide de deploiement GeOSM API v3.0

Ce document decrit le deploiement de l'API GeOSM en production avec Docker.

---

## Architecture des services

Le deploiement complet comprend **13 services** :

### Services principaux

| Service | Image | Port | Role |
|---|---|---|---|
| **api** | Build local (Node.js 22) | 3000 | API GeOSM (Fastify 5) |
| **postgres** | `postgis/postgis:16-3.4` | 5432 | Base de donnees PostgreSQL + PostGIS |
| **redis** | `redis:7-alpine` | 6379 | Cache + backend BullMQ |
| **minio** | `minio/minio:RELEASE.2024-01-16` | 9000, 9001 | Stockage objet (S3) |
| **meilisearch** | `getmeili/meilisearch:v1.6` | 7700 | Moteur de recherche full-text |
| **qgis-server** | `camptocamp/qgis-server:3.28` | 8380 | Serveur cartographique WMS/WFS |

### Stack d'observabilite

| Service | Image | Port | Role |
|---|---|---|---|
| **grafana** | `grafana/grafana:10.2.0` | 3001 | Tableaux de bord et visualisation |
| **prometheus** | `prom/prometheus:v2.48.0` | 9090 | Collecte de metriques |
| **jaeger** | `jaegertracing/all-in-one:1.52` | 16686, 4318 | Tracing distribue (OpenTelemetry) |
| **graylog** | `graylog/graylog:5.2` | 9009, 12201/udp | Gestion centralisee des logs (GELF) |
| **mongodb** | `mongo:6.0` | -- | Backend Graylog |
| **opensearch** | `opensearchproject/opensearch:2.11.0` | -- | Indexation des logs (Graylog) |

---

## Deploiement Docker pas a pas

### 1. Prerequis

- Docker 24+ et Docker Compose v2+
- Au minimum 4 Go de RAM disponible
- 20 Go d'espace disque (plus selon les donnees)

### 2. Cloner le depot

```bash
git clone https://github.com/geosm/geosm-api.git
cd geosm-api
```

### 3. Configurer l'environnement

```bash
cp .env.example .env
```

Editer `.env` avec les valeurs de production. Variables critiques :

```bash
# Application
NODE_ENV=production
APP_URL=https://api.geosm.org

# Base de donnees
DATABASE_URL=postgresql://geosm:MOT_DE_PASSE_FORT@postgres:5432/geosm?schema=public
POSTGRES_PASSWORD=MOT_DE_PASSE_FORT

# JWT - Generer des secrets uniques et forts
JWT_ACCESS_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)

# MinIO
MINIO_ACCESS_KEY=cle_acces_forte
MINIO_SECRET_KEY=cle_secrete_forte

# MeiliSearch
MEILISEARCH_API_KEY=cle_meilisearch_forte

# Redis
REDIS_PASSWORD=mot_de_passe_redis

# Super admin
SUPER_ADMIN_EMAIL=admin@votre-domaine.org
SUPER_ADMIN_PASSWORD=MotDePasseAdmin!Fort123

# CORS
CORS_ORIGIN=https://votre-frontend.org

# SMTP
SMTP_HOST=smtp.votre-provider.com
SMTP_PORT=587
SMTP_USER=votre-utilisateur
SMTP_PASS=votre-mot-de-passe
SMTP_FROM=noreply@votre-domaine.org
```

### 4. Demarrer les services

```bash
# Demarrer tous les services en arriere-plan
docker compose up -d

# Verifier que tous les services sont en bonne sante
docker compose ps

# Suivre les logs
docker compose logs -f api
```

### 5. Initialiser la base de donnees

```bash
# Executer les migrations Prisma
docker compose exec api npx prisma migrate deploy

# Initialiser la base (creer le super admin)
docker compose exec api npm run db:seed
```

### 6. Creer le bucket MinIO

```bash
# Acceder a la console MinIO : http://localhost:9001
# Ou via la CLI :
docker compose exec minio mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
docker compose exec minio mc mb local/geosm
```

### 7. Verifier le deploiement

```bash
# Verification de sante
curl http://localhost:3000/health

# Documentation Swagger
# Ouvrir http://localhost:3000/docs dans un navigateur
```

---

## Configuration de l'environnement de production

### Variables d'environnement essentielles

Voir la section [Variables d'environnement](../README.md) du README pour la liste complete. En production, assurez-vous de :

- Definir `NODE_ENV=production`
- Utiliser des secrets JWT forts et uniques (au moins 64 caracteres hexadecimaux)
- Configurer un vrai serveur SMTP pour les emails
- Definir `CORS_ORIGIN` vers votre domaine frontend
- Changer le mot de passe super admin par defaut
- Configurer des mots de passe forts pour PostgreSQL, Redis et MinIO

### Limites de ressources

Le `docker-compose.yml` inclut des limites de ressources :

| Service | CPU max | RAM max | CPU reserve | RAM reserve |
|---|---|---|---|---|
| api | 2.0 | 1 Go | 0.5 | 256 Mo |
| postgres | 2.0 | 2 Go | 0.5 | 512 Mo |
| redis | 0.5 | 512 Mo | 0.1 | 64 Mo |
| minio | 0.5 | 512 Mo | 0.1 | 128 Mo |
| meilisearch | 1.0 | 512 Mo | 0.1 | 128 Mo |
| qgis-server | 2.0 | 1 Go | 0.25 | 256 Mo |
| grafana | 0.5 | 256 Mo | 0.1 | 64 Mo |
| prometheus | 0.5 | 512 Mo | 0.1 | 128 Mo |
| jaeger | 1.0 | 512 Mo | 0.1 | 128 Mo |
| graylog | 1.0 | 1 Go | 0.25 | 256 Mo |
| mongodb | 0.5 | 512 Mo | 0.1 | 128 Mo |
| opensearch | 1.0 | 512 Mo | 0.25 | 256 Mo |

Ajustez ces valeurs selon votre charge.

---

## Setup initial (migrations, seed, admin)

### Migrations de base de donnees

```bash
# En developpement (genere aussi le client Prisma)
npm run db:migrate

# En production (applique les migrations existantes)
npx prisma migrate deploy
```

### Seed (initialisation)

```bash
# Creer le super administrateur
npm run db:seed
```

Le seed cree un utilisateur avec les identifiants definis dans les variables `SUPER_ADMIN_*`.

### Premiere connexion

1. Se connecter avec le compte super admin : `POST /api/v1/auth/login`
2. Creer la premiere instance (pays) : `POST /api/v1/instances`
3. Initialiser les themes par defaut : `POST /api/v1/default-themes/seed`
4. Importer les donnees OSM : `POST /api/v1/admin/osm/import`

---

## SSL/TLS avec Nginx

### Configuration Nginx en reverse proxy

Creer le fichier `/etc/nginx/sites-available/geosm-api` :

```nginx
server {
    listen 80;
    server_name api.geosm.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.geosm.org;

    ssl_certificate /etc/letsencrypt/live/api.geosm.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.geosm.org/privkey.pem;

    # Parametres SSL recommandes
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    # En-tetes de securite
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # Taille maximale des uploads (adapter selon vos besoins)
    client_max_body_size 100M;

    # API
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout pour les requetes longues (exports, imports)
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }
}
```

### Certificat SSL avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir le certificat
sudo certbot --nginx -d api.geosm.org

# Renouvellement automatique (deja configure par Certbot)
sudo certbot renew --dry-run
```

---

## Monitoring

### Metriques Prometheus

L'API expose des metriques Prometheus sur `GET /metrics` quand `PROMETHEUS_ENABLED=true`. Metriques disponibles :

- Duree des requetes HTTP (histogramme)
- Nombre de requetes par methode/route/status
- Metriques Node.js (memoire, CPU, event loop)

### Configuration Prometheus

Ajouter dans `prometheus.yml` :

```yaml
scrape_configs:
  - job_name: 'geosm-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
```

### Verification de sante

Les sondes de sante sont disponibles sans authentification :

| Endpoint | Usage |
|---|---|
| `GET /health` | Verification generale (status, uptime, timestamp) |
| `GET /health/ready` | Sonde de disponibilite (Kubernetes readinessProbe) |
| `GET /health/live` | Sonde de vivacite (Kubernetes livenessProbe) |

Le Dockerfile inclut un HEALTHCHECK :

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1
```

### Stack d'observabilite complete

Le `docker-compose.yml` inclut une stack d'observabilite complete :

#### Grafana (port 3001)

Tableaux de bord preconfigures pour visualiser les metriques Prometheus. Acces : `http://localhost:3001` (admin/admin par defaut).

#### Jaeger (port 16686)

Tracing distribue via OpenTelemetry (OTLP). L'API envoie les traces au collecteur Jaeger sur le port 4318. Interface : `http://localhost:16686`.

Variables d'environnement :
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=geosm-api
```

#### Graylog (port 9009)

Gestion centralisee des logs via GELF (UDP port 12201). Interface : `http://localhost:9009`. Necessite MongoDB et OpenSearch comme backends.

Variables d'environnement :
```bash
GRAYLOG_HOST=graylog
GRAYLOG_PORT=12201
```

#### Alerting

L'API supporte les alertes via :
- **Slack** : `SLACK_WEBHOOK_URL`
- **Email** : `ALERT_EMAIL_TO`

### Logs

Les logs sont geres par Winston avec le niveau configurable via `LOG_LEVEL`. En production, utiliser `info` ou `warn`.

```bash
# Voir les logs de l'API
docker compose logs -f api

# Filtrer par niveau
docker compose logs api | grep "error"
```

---

## CI/CD et versionnage

Le deploiement automatique est gere par GitHub Actions (`deploy.yml`) :

1. **Tests** : Execution de la suite de tests complete (800+ tests)
2. **Build Docker** : Construction de l'image avec Node.js 22
3. **Push GHCR** : Publication sur GitHub Container Registry
4. **Tag de version** : Format `yyyyMMdd.numBuild` (ex: `20260626.1`)
5. **Release GitHub** : Creation automatique avec changelog

L'image Docker est disponible sur :
```
ghcr.io/geosmfamily/geosm-api-refactor:<version>
ghcr.io/geosmfamily/geosm-api-refactor:latest
```

---

## Sauvegarde

### Base de donnees PostgreSQL

```bash
# Sauvegarde complete
docker compose exec postgres pg_dump -U geosm -Fc geosm > backup_$(date +%Y%m%d_%H%M%S).dump

# Restauration
docker compose exec -T postgres pg_restore -U geosm -d geosm --clean < backup.dump
```

### Donnees MinIO

```bash
# Sauvegarde du bucket
docker compose exec minio mc mirror local/geosm /backup/minio/geosm

# Ou sauvegarder le volume Docker directement
docker run --rm -v geosm-api_minio-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/minio_backup.tar.gz /data
```

### Projets QGIS

```bash
# Sauvegarder les fichiers de projets QGIS
docker run --rm -v geosm-api_qgis-projects:/data -v $(pwd):/backup \
  alpine tar czf /backup/qgis_projects_backup.tar.gz /data
```

### Script de sauvegarde automatique

```bash
#!/bin/bash
# backup.sh - A executer quotidiennement via cron
BACKUP_DIR=/var/backups/geosm
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Base de donnees
docker compose exec -T postgres pg_dump -U geosm -Fc geosm \
  > $BACKUP_DIR/db_$DATE.dump

# MinIO
docker run --rm -v geosm-api_minio-data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/minio_$DATE.tar.gz /data

# QGIS
docker run --rm -v geosm-api_qgis-projects:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/qgis_$DATE.tar.gz /data

# Nettoyer les sauvegardes de plus de 30 jours
find $BACKUP_DIR -mtime +30 -delete

echo "Sauvegarde terminee: $DATE"
```

Ajouter au crontab :

```bash
# Sauvegarde quotidienne a 2h du matin
0 2 * * * /opt/geosm/backup.sh >> /var/log/geosm-backup.log 2>&1
```

---

## Mise a l'echelle

### Mise a l'echelle horizontale de l'API

L'API est sans etat (stateless) grace a JWT et Redis. Pour la mise a l'echelle :

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2.0'
          memory: 1024M
```

Avec un load balancer Nginx :

```nginx
upstream geosm_api {
    least_conn;
    server api_1:3000;
    server api_2:3000;
    server api_3:3000;
}

server {
    location / {
        proxy_pass http://geosm_api;
    }
}
```

### Mise a l'echelle de PostgreSQL

- Activer le connection pooling avec PgBouncer
- Configurer les replicas en lecture pour les requetes lourdes
- Augmenter `shared_buffers`, `work_mem` et `effective_cache_size`

### Mise a l'echelle de Redis

- Redis est configure avec `maxmemory 256mb` et politique `allkeys-lru`
- Pour plus de capacite, augmenter `maxmemory`
- Pour la haute disponibilite, utiliser Redis Sentinel ou Redis Cluster

### Mise a l'echelle de QGIS Server

QGIS Server peut etre gourmand en ressources pour le rendu WMS :
- Deployer plusieurs instances derriere un load balancer
- Partager le volume `qgis-projects` en lecture seule
- Augmenter les limites CPU et memoire

### Conseils de performance

- **PostGIS** : Creer des index spatiaux (GIST) sur toutes les colonnes geometriques
- **Redis** : Utiliser pour le cache des requetes frequentes (catalogue, themes)
- **MeiliSearch** : Indexer uniquement les champs necessaires a la recherche
- **MinIO** : Utiliser des presigned URLs pour les telechargements directs
- **QGIS Server** : Configurer le cache de tuiles WMS
