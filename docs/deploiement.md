# Guide de deploiement GeOSM (production)

Checklist etape par etape pour deployer GeOSM sur un VPS vierge, du serveur nu jusqu'a
l'application fonctionnelle. Si une etape manque ici pour reussir un deploiement reel, c'est un
bug de ce document, pas juste une note manquante.

---

## Architecture des services

Le deploiement complet comprend **15 services** (2 applicatifs + 13 d'infrastructure/observabilite) :

### Services applicatifs

| Service | Image | Variable de port (hote) | Defaut | Role |
|---|---|---|---|---|
| **frontend** | `ghcr.io/geosmfamily/geosm-frontend-refactor:<tag>` | `FRONTEND_PORT` | 80 (**8080 recommande en prod**, voir section 6) | Angular + nginx, reverse proxy applicatif de toute la stack (relaie vers `api`/`qgis-server`) ; un reverse proxy systeme (Apache/Nginx/Caddy) prend ensuite ce port en charge pour le TLS public |
| **api** | `ghcr.io/geosmfamily/geosm-api-refactor:<tag>` | `APP_PORT` | 3005 | API GeOSM (Fastify 5) |

### Donnees et recherche

| Service | Image | Variable de port (hote) | Defaut | Role |
|---|---|---|---|---|
| **postgres** | `postgis/postgis:16-3.4` | `POSTGRES_PORT` | 5432 | Base de donnees PostgreSQL + PostGIS |
| **redis** | `redis:7-alpine` | `REDIS_HOST_PORT` | 6379 | Cache + backend BullMQ |
| **minio** | `minio/minio:RELEASE.2024-01-16` | `MINIO_PUBLIC_PORT`, `MINIO_CONSOLE_PORT` | 9000, 9001 | Stockage objet (S3) - exports, documents, sauvegardes |
| **meilisearch** | `getmeili/meilisearch:v1.6` | `MEILISEARCH_PORT` | 7700 | Moteur de recherche full-text |
| **qgis-server** | `camptocamp/qgis-server:3.28` | `QGIS_SERVER_PORT` | 8380 | Serveur cartographique WMS/WFS |

### Geocodage et itineraires (auto-heberges, Lot P9)

| Service | Image | Variable de port (hote) | Defaut | Role |
|---|---|---|---|---|
| **nominatim** | `mediagis/nominatim:4.5` | `NOMINATIM_PORT` | 8081 | Geocodage direct/inverse - remplace le serveur public de demo |
| **osrm** | `osrm/osrm-backend` | `OSRM_PORT` | 5000 | Calcul d'itineraires routiers - remplace le serveur public de demo |

> En developpement, `NOMINATIM_URL`/`OSRM_URL` pointent encore sur les serveurs publics
> (`nominatim.openstreetmap.org`, `router.project-osrm.org`). Leurs politiques d'usage ("light
> testing only", 1 requete/seconde) ne supportent pas un trafic de production - voir
> [Auto-hebergement Nominatim et OSRM](#auto-hebergement-nominatim-et-osrm) plus bas.

### Stack d'observabilite

| Service | Image | Variable de port (hote) | Defaut | Role |
|---|---|---|---|---|
| **grafana** | `grafana/grafana:10.2.0` | `GRAFANA_PORT` | 3001 | Tableaux de bord et visualisation |
| **prometheus** | `prom/prometheus:v2.48.0` | `PROMETHEUS_PORT` | 9090 | Collecte de metriques |
| **jaeger** | `jaegertracing/all-in-one:1.52` | `JAEGER_UI_PORT`, `JAEGER_OTLP_PORT` | 16686, 4318 | Tracing distribue (OpenTelemetry) |
| **graylog** | `graylog/graylog:5.2` | `GRAYLOG_WEB_PORT`, `GRAYLOG_GELF_PORT` | 9009, 12201/udp | Gestion centralisee des logs (GELF) |
| **mongodb** | `mongo:6.0` | -- | -- | Backend Graylog (pas de port publie sur l'hote) |
| **opensearch** | `opensearchproject/opensearch:2.11.0` | -- | -- | Indexation des logs (Graylog, pas de port publie sur l'hote) |

**Tous ces ports sont surchargeables depuis `.env`** (voir le bloc "Ports publies sur l'hote"
en tete de `.env.example`) - utile si un autre service tourne deja sur l'un de ces ports sur le
meme VPS. Changer le NUMERO de port n'a aucun impact sur le reste de la stack (les services se
parlent toujours entre eux par nom Docker sur leur port interne fixe, ex. `postgres:5432`) ni
sur leur niveau d'exposition (tous restes lies a `127.0.0.1` en production, sauf `frontend`).

Tous les services sont lies a `127.0.0.1` en production (`docker-compose.prod.yml`), **a deux
exceptions volontaires pres** :
- `frontend` (port `FRONTEND_PORT`) - relaye par le reverse proxy systeme (Apache/Nginx/Caddy,
  hors Docker, voir [section 6](#6-reverse-proxy-et-ssl)) qui ecoute sur 80/443. Le conteneur
  `frontend` (nginx) fait ensuite office de reverse proxy applicatif interne vers l'API
  (`/api/` -> `api:3000`) et QGIS Server (`/ows` -> `qgis-server:8080`) sur le reseau Docker.
- `minio`, uniquement son port S3 (`MINIO_PUBLIC_PORT`, **pas** `MINIO_CONSOLE_PORT` qui reste
  prive) - les URLs presignees de telechargement (exports, documents, imports QGIS, raster)
  pointent directement sur ce port et doivent etre atteignables par le navigateur des
  visiteurs. Ce port doit etre ouvert explicitement dans le firewall du VPS (voir
  [Prerequis](#1-prerequis) et l'etape [Demarrer la stack complete](#7-demarrer-la-stack-complete)).
  Trafic HTTP brut sur ce port precis (pas de TLS) - accepte car les URLs sont presignees a
  duree de vie limitee (voir `getPresignedUrl`, expiration par defaut 1h).

---

## 1. Prerequis

- Un VPS avec au moins **4 vCPU et 8 Go de RAM** (Nominatim et OSRM sont plus gourmands que le
  reste de la stack - voir leurs limites de ressources dans `docker-compose.prod.yml`)
- **40 Go d'espace disque** minimum (extract OSM regional + import Nominatim + volumes Postgres/MinIO)
- Docker 24+ et Docker Compose v2+ installes
- Un nom de domaine pointant vers l'IP du VPS (enregistrement DNS `A`)
- Acces SSH avec une cle dediee au deploiement (voir [CI/CD](#10-cicd-et-deploiement-continu-a-faire-sur-github-avant-ou-apres-le-premier-lancement-manuel))
- Firewall du VPS autorisant en entree : `80`/`443` (reverse proxy systeme) et le port MinIO
  public (`MINIO_PUBLIC_PORT`, defaut `9000`, voir [Architecture des
  services](#architecture-des-services)) - tous les autres ports de la stack restent internes,
  aucune autre ouverture necessaire. Exemple avec `ufw` :
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 9000/tcp
  ```

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
# Une seule origine publique pour toute la stack (voir Architecture des services plus haut) :
# le frontend (nginx) est le seul service expose publiquement et relaie deja /api/ -> api et
# /ows -> qgis-server en interne. Il n'y a donc PAS de sous-domaine api.votre-domaine.org a
# creer - APP_URL et CORS_ORIGIN pointent sur le meme domaine que le frontend.
APP_URL=https://votre-domaine.org
CORS_ORIGIN=https://votre-domaine.org
# Port interne (localhost du VPS) sur lequel le conteneur frontend publie nginx - c'est CE
# port que le reverse proxy du systeme (Apache/Nginx/Caddy, section 6) doit cibler. Ne jamais
# mettre 80 ou 443 ici si un reverse proxy systeme tourne deja sur ces ports.
FRONTEND_PORT=8080

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
# scope read_prefs, redirect URI exacte : https://votre-domaine.org/api/v1/auth/osm/callback
# (meme domaine que APP_URL/CORS_ORIGIN ci-dessus, PAS de sous-domaine api.)
OSM_OAUTH_CLIENT_ID=<fourni par osm.org>
OSM_OAUTH_CLIENT_SECRET=<fourni par osm.org>
OSM_OAUTH_REDIRECT_URI=https://votre-domaine.org/api/v1/auth/osm/callback
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

# Fond de carte Mapbox par defaut (optionnel - omis de la liste des fonds de carte si absent) -
# generer le votre sur https://account.mapbox.com/access-tokens/
MAPBOX_ACCESS_TOKEN=<votre cle>

# Backup PostgreSQL programme - valeurs par defaut deja adaptees a la prod, a ajuster si besoin
BACKUP_CRON=0 3 * * *
BACKUP_RETENTION_DAYS=30

# Secrets internes au conteneur Graylog (voir docker-compose.yml) - generation :
# GRAYLOG_PASSWORD_SECRET : openssl rand -hex 32
# GRAYLOG_ROOT_PASSWORD_SHA2 : echo -n 'VotreMotDePasseAdminGraylog' | sha256sum
GRAYLOG_PASSWORD_SECRET=<genere>
GRAYLOG_ROOT_PASSWORD_SHA2=<genere>

# "production" en prod (desactive les logs verbeux / l'UI d'analytics de Meilisearch)
MEILI_ENV=production
```

> **Rappel** : `MAPBOX_ACCESS_TOKEN` (backend) et le token Mapillary (`mapillaryToken` dans
> `src/environments/environment.prod.ts` du depot frontend, injecte au build via le secret
> GitHub Actions `MAPILLARY_TOKEN` - voir [CI/CD](#10-cicd-et-deploiement-continu-a-faire-sur-github-avant-ou-apres-le-premier-lancement-manuel)) doivent etre
> des tokens **que vous generez vous-meme**, distincts de ceux ayant pu circuler dans
> d'anciennes versions du code source pendant le developpement. Si un token a deja ete commite
> par erreur dans l'historique Git a un moment donne, considerez-le compromis : revoquez-le sur
> le tableau de bord du fournisseur (mapbox.com / mapillary.com) avant de mettre l'app en ligne,
> meme si le fichier actuel ne le contient plus.

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
`/ows` vers `qgis-server`). Il manque uniquement la couche TLS publique, assuree par un reverse
proxy **systeme** (installe directement sur le VPS, en dehors de Docker) qui ecoute sur les
ports 80/443 et relaie vers le port interne publie par le conteneur `frontend`
(`FRONTEND_PORT`, voir section 4 - a definir sur un port libre type `8080`, jamais 80/443).
Trois options equivalentes :

### Option A - Apache + Certbot (deployement reel GeOSM - domaine `geosm.app`)

C'est la configuration utilisee pour le deploiement officiel de GeOSM. Apache et Certbot sont
supposes deja installes sur le VPS (`apt install apache2 certbot python3-certbot-apache`).

**1. Activer les modules Apache necessaires au reverse proxy :**

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel headers rewrite ssl
sudo systemctl restart apache2
```

`proxy_wstunnel` n'est pas strictement necessaire aujourd'hui (aucune fonctionnalite front-end
n'utilise le canal WebSocket cote client actuellement), mais l'activer par defaut evite une
etape de configuration oubliee le jour ou ce sera le cas.

**2. Definir `FRONTEND_PORT` dans `.env`** (le port interne que nginx, dans le conteneur
`frontend`, va publier sur le VPS - Apache doit cibler ce meme port) :

```bash
# Dans /opt/geosm/.env
FRONTEND_PORT=8080
```

**3. Creer le virtual host Apache** (`/etc/apache2/sites-available/geosm.app.conf`) :

```apacheconf
<VirtualHost *:80>
    ServerName geosm.app
    ServerAlias www.geosm.app

    ProxyPreserveHost On
    ProxyRequests Off

    # Tout le trafic (SPA Angular, /api/, /ows) passe par le port publie par le conteneur
    # frontend - c'est nginx (dans ce conteneur) qui route ensuite en interne vers api/
    # qgis-server (voir nginx.conf du depot frontend). Apache n'a besoin de connaitre
    # qu'un seul port cote Docker.
    ProxyPass / http://127.0.0.1:8080/
    ProxyPassReverse / http://127.0.0.1:8080/

    # Support WebSocket (voir note proxy_wstunnel plus haut) - inoffensif si non utilise
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*) ws://127.0.0.1:8080/$1 [P,L]

    ErrorLog ${APACHE_LOG_DIR}/geosm-error.log
    CustomLog ${APACHE_LOG_DIR}/geosm-access.log combined
</VirtualHost>
```

```bash
sudo a2ensite geosm.app.conf
sudo apache2ctl configtest   # doit afficher "Syntax OK"
sudo systemctl reload apache2
```

**4. Verifier que le DNS pointe deja vers le VPS** (obligatoire avant Certbot - Let's Encrypt
valide le domaine en interrogeant le DNS public) :

```bash
dig +short geosm.app        # doit renvoyer l'IP du VPS
dig +short www.geosm.app    # idem
```

**5. Emettre le certificat TLS avec Certbot** (plugin Apache : modifie automatiquement le vhost
ci-dessus pour ajouter un bloc `<VirtualHost *:443>` avec les directives SSL et la redirection
80 -> 443, aucune edition manuelle necessaire) :

```bash
sudo certbot --apache -d geosm.app -d www.geosm.app
# Choisir l'option de redirection automatique HTTP -> HTTPS quand Certbot la propose
```

Certbot installe egalement un timer systemd (`certbot.timer`) qui renouvelle le certificat
automatiquement avant son expiration (tous les 90 jours). Verifier que le renouvellement
automatique fonctionne bien sans intervention :

```bash
sudo certbot renew --dry-run
```

**6. (Recommande) Ajouter les en-tetes de securite et `X-Forwarded-Proto`** dans le bloc
`<VirtualHost *:443>` genere par Certbot (`/etc/apache2/sites-available/geosm.app-le-ssl.conf`) :

```apacheconf
RequestHeader set X-Forwarded-Proto "https"
Header always set Strict-Transport-Security "max-age=63072000"
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
```

```bash
sudo systemctl reload apache2
```

> A ce jour, aucune logique cote API ne depend de `X-Forwarded-Proto` (pas de cookie
> `secure`/redirection conditionnelle au protocole) - cette etape est une bonne pratique pour
> des logs/futures fonctionnalites exactes, pas un correctif d'un bug existant.

### Option B - Caddy devant le port 80 du frontend (alternative la plus simple, TLS automatique)

Pertinent uniquement si Apache n'est pas deja impose sur le VPS (ce qui n'est pas le cas du
deploiement GeOSM actuel, voir Option A ci-dessus).

```
# Caddyfile
votre-domaine.org {
    reverse_proxy localhost:8080
}
```

### Option C - Nginx + Certbot (alternative)

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
        proxy_pass http://localhost:8080;
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
- [ ] Un export (ou tout autre telechargement genere via URL presignee) s'ouvre bien depuis un navigateur **externe au VPS** (pas juste `curl` depuis le serveur) - confirme que le port `MINIO_PUBLIC_PORT` est bien ouvert dans le firewall
- [ ] Grafana (port `GRAFANA_PORT`, defaut `:3001`, via tunnel SSH - non expose publiquement) affiche des metriques recentes
- [ ] Jaeger (port `JAEGER_UI_PORT`, defaut `:16686`) affiche des traces recentes pour une requete Gemini/OSRM/Nominatim
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
| `MAPBOX_ACCESS_TOKEN` | Regenere depuis account.mapbox.com/access-tokens | Le fond de carte "Mapbox Streets" cesse de charger jusqu'a mise a jour + redemarrage `api` (les autres fonds de carte ne sont pas affectes) |
| `MAPILLARY_TOKEN` (secret GitHub Actions, depot **frontend**) | Regenere depuis mapillary.com/dashboard/developers | Ne prend effet qu'au prochain build/deploiement frontend (le token est bake dans le bundle au build, pas lu au runtime) |
| `DEPLOY_SSH_KEY` (secret GitHub Actions, **les deux depots**) | Nouvelle paire de cles dediee au deploiement, generee **hors** du VPS (poste local) :<br>`ssh-keygen -t ed25519 -C "geosm-deploy" -f ./geosm_deploy_key -N ""`<br>Copier la cle **publique** sur le VPS : `ssh-copy-id -i geosm_deploy_key.pub deploy@<IP_VPS>` (ou coller son contenu dans `~deploy/.ssh/authorized_keys`).<br>Coller le contenu de la cle **privee** (`cat geosm_deploy_key`) dans le secret GitHub `DEPLOY_SSH_KEY` | Mettre a jour `authorized_keys` sur le VPS avant de revoquer l'ancienne |

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

## 10. CI/CD et deploiement continu (a faire sur GitHub, avant OU apres le premier lancement manuel)

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

**Etape 1 - generer la cle SSH dediee** (une seule fois, sur votre poste local, PAS sur le VPS
ni dans GitHub) :

```bash
ssh-keygen -t ed25519 -C "geosm-deploy" -f ./geosm_deploy_key -N ""
# -N "" : pas de passphrase (necessaire car la cle est utilisee de facon non interactive par
# GitHub Actions - une cle protegee par passphrase bloquerait le pipeline)
```

Deux fichiers sont crees : `geosm_deploy_key` (privee - va dans le secret GitHub) et
`geosm_deploy_key.pub` (publique - va sur le VPS).

**Etape 2 - autoriser la cle publique sur le VPS** (utilisateur `deploy` cree en section 2) :

```bash
ssh-copy-id -i geosm_deploy_key.pub deploy@<IP_DU_VPS>
# Verification : la commande suivante doit reussir sans demander de mot de passe
ssh -i geosm_deploy_key deploy@<IP_DU_VPS> "echo OK"
```

**Etape 3 - creer les secrets et variables GitHub.** Sur **chacun des deux depots** (backend et
frontend), aller dans **Settings -> Secrets and variables -> Actions**, onglet **Secrets**,
bouton **New repository secret** pour chacune des lignes suivantes :

| Nom du secret | Ou creer ce secret | Valeur |
|---|---|---|
| `DEPLOY_SSH_HOST` | Backend **et** frontend | IP publique ou nom de domaine du VPS (ex. `geosm.app` une fois le DNS en place, ou l'IP brute avant) |
| `DEPLOY_SSH_USER` | Backend **et** frontend | `deploy` |
| `DEPLOY_SSH_KEY` | Backend **et** frontend | Contenu complet de `geosm_deploy_key` (la cle **privee**, `cat geosm_deploy_key`) - coller tel quel, en-tetes `-----BEGIN OPENSSH PRIVATE KEY-----`/`-----END...` compris |
| `DEPLOY_PATH` | Backend **et** frontend | `/opt/geosm` (chemin du depot **backend** clone sur le VPS - les deux workflows s'y referent, meme celui du frontend, car c'est la que vivent `docker-compose*.yml` et `.env`) |
| `MAPILLARY_TOKEN` | **Frontend uniquement** | Votre token Mapillary de production (genere sur mapillary.com/dashboard/developers) - injecte dans l'image au build, jamais lu au runtime |

Puis, onglet **Variables** (a cote de "Secrets" dans le meme ecran), bouton **New repository
variable**, sur **chacun des deux depots** :

| Nom de la variable | Valeur |
|---|---|
| `DEPLOY_ENABLED` | `true` |

Tant que `DEPLOY_ENABLED` n'est pas definie (ou vaut autre chose que `true`), le job de
deploiement reste un no-op silencieux - cela permet de merger et tester le reste du pipeline
(tests, build, push GHCR) avant que le VPS soit pret, sans risquer un deploiement accidentel.

`build-and-push` et la creation de release fonctionnent independamment de tout ceci (image
publiee sur GHCR a chaque merge sur `main` des la premiere activation du repo) - seul le
deploiement SSH est conditionnel a `DEPLOY_ENABLED` + aux 4 secrets SSH.

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
