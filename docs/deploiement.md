# Guide de deploiement GeOSM (production)

Checklist etape par etape pour deployer GeOSM sur un VPS vierge, du serveur nu jusqu'a
l'application fonctionnelle. Si une etape manque ici pour reussir un deploiement reel, c'est un
bug de ce document, pas juste une note manquante.

Ce guide a ete entierement revu le 2026-07-09 apres un deploiement complet en conditions
reelles sur `geosm.app`, qui a fait remonter plusieurs pieges non documentes jusque-la (voir la
section [Depannage](#depannage---incidents-reels-et-solutions) en fin de document, qui recense
chaque probleme reellement rencontre et sa cause exacte). Les correctifs de code correspondants
sont deja integres au depot - en suivant ce guide dans l'ordre, vous ne devriez rencontrer aucun
de ces problemes.

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
> [Auto-hebergement Nominatim et OSRM](#5-auto-hebergement-nominatim-et-osrm) plus bas.

### Stack d'observabilite

| Service | Image | Variable de port (hote) | Defaut | Role |
|---|---|---|---|---|
| **grafana** | `grafana/grafana:10.2.0` | `GRAFANA_PORT` | 3001 | Tableaux de bord et visualisation |
| **prometheus** | `prom/prometheus:v2.48.0` | `PROMETHEUS_PORT` | 9090 | Collecte de metriques |
| **jaeger** | `jaegertracing/all-in-one:1.52` | `JAEGER_UI_PORT`, `JAEGER_OTLP_PORT` | 16686, 4318 | Tracing distribue (OpenTelemetry) |
| **graylog** | `graylog/graylog:5.2` | `GRAYLOG_WEB_PORT`, `GRAYLOG_GELF_PORT` | 9009, 12201/udp | Gestion centralisee des logs (GELF) |
| **mongodb** | `mongo:6.0` | -- | -- | Backend Graylog (pas de port publie sur l'hote) |
| **opensearch** | `opensearchproject/opensearch:2.11.0` | -- | -- | Indexation des logs (Graylog, pas de port publie sur l'hote) - **1.5 Go de RAM minimum reserves**, voir note dans la section 1 |

**Tous ces ports sont surchargeables depuis `.env`** (voir le bloc "Ports publies sur l'hote"
en tete de `.env.example`) - utile si un autre service tourne deja sur l'un de ces ports sur le
meme VPS (frequent sur un serveur mutualise avec d'autres applications). Changer le NUMERO de
port n'a aucun impact sur le reste de la stack (les services se parlent toujours entre eux par
nom Docker sur leur port interne fixe, ex. `postgres:5432`) ni sur leur niveau d'exposition
(tous restes lies a `127.0.0.1` en production, sauf `frontend` et `minio`, voir juste en
dessous). Si vous deployez sur un VPS deja charge, envisagez de choisir une plage dediee (ex.
15000-15025) pour tous ces ports d'un coup plutot que de garder les valeurs par defaut au cas
par cas.

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
  [Prerequis](#1-prerequis)). Trafic HTTP brut sur ce port precis (pas de TLS) - accepte car les
  URLs sont presignees a duree de vie limitee (voir `getPresignedUrl`, expiration par defaut 1h).

---

## 1. Prerequis

- Un VPS avec au moins **4 vCPU et 8 Go de RAM** (Nominatim et OSRM sont plus gourmands que le
  reste de la stack - voir leurs limites de ressources dans `docker-compose.prod.yml`).
  OpenSearch (backend de Graylog) a lui seul besoin d'environ **1.5 Go reserves** - sur un VPS
  deja charge par d'autres applications, une limite trop basse le fait tuer par le noyau (OOM)
  en boucle, symptome : "Killed" dans ses logs, Graylog ne parvenant jamais a s'y connecter
  ("Connection refused"). Voir [Depannage](#depannage---incidents-reels-et-solutions).
- **40 Go d'espace disque** minimum (extract OSM regional + import Nominatim + volumes Postgres/MinIO)
- Docker 24+ et Docker Compose v2+ installes
- Un nom de domaine pointant vers l'IP du VPS (enregistrement DNS `A`) - **verifiez aussi tout
  sous-domaine `www.`** : certains registrars (Gandi notamment) configurent `www` par defaut
  comme une "redirection web" plutot qu'un enregistrement DNS classique, ce qui fait echouer la
  validation Certbot pour ce sous-domaine specifiquement. Verification :
  ```bash
  dig +short votre-domaine.org
  dig +short www.votre-domaine.org
  ```
  Les deux doivent renvoyer l'IP du VPS (directement, ou via un `CNAME` qui y mene) - pas
  l'adresse d'un service de redirection tiers.
- Acces SSH avec une cle dediee au deploiement (voir [CI/CD](#11-cicd-et-deploiement-continu-a-faire-sur-github-avant-ou-apres-le-premier-lancement-manuel))
- Firewall du VPS autorisant en entree : `80`/`443` (reverse proxy systeme) et le port MinIO
  public (`MINIO_PUBLIC_PORT`, defaut `9000`, voir [Architecture des
  services](#architecture-des-services)) - tous les autres ports de la stack restent internes,
  aucune autre ouverture necessaire. Exemple avec `ufw` :
  ```bash
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 9000/tcp
  sudo ufw enable
  ```
- Si vous prevoyez d'utiliser le script `scripts/seed-admin-boundaries.sh` (limites
  administratives, voir section 5) : `psql` et `ogr2ogr` doivent etre installes **sur l'hote**
  (ce script tourne en dehors de Docker) :
  ```bash
  sudo apt install -y postgresql-client gdal-bin
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

**Rendre tous les scripts executables** (necessaire une seule fois - `git clone` ne preserve pas
toujours le bit d'execution selon le systeme, symptome sinon : `Permission denied` a chaque
script lance dans ce guide) :

```bash
chmod +x scripts/*.sh docker/entrypoint.sh
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

# Super admin - IMPORTANT : le mot de passe par defaut de .env.example
# ("AdminP@ssw0rd!") est un exemple documente publiquement, jamais un secret reel - le
# remplacer est obligatoire, pas juste recommande.
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

> **Rappel important** : `MAPBOX_ACCESS_TOKEN` (backend) et le token Mapillary (`mapillaryToken`
> dans `src/environments/environment.prod.ts` du depot frontend, injecte au build via le secret
> GitHub Actions `MAPILLARY_TOKEN` - voir [CI/CD](#11-cicd-et-deploiement-continu-a-faire-sur-github-avant-ou-apres-le-premier-lancement-manuel))
> doivent etre des tokens **que vous generez vous-meme**, distincts de ceux ayant pu circuler
> dans d'anciennes versions du code source pendant le developpement. Si un token a deja ete
> commite par erreur dans l'historique Git a un moment donne, considerez-le compromis :
> revoquez-le sur le tableau de bord du fournisseur (mapbox.com / mapillary.com) avant de mettre
> l'app en ligne, meme si le fichier actuel ne le contient plus, et **meme s'il semble encore
> repondre a un test d'API direct** - un token expose publiquement doit etre remplace, pas
> juste verifie comme "encore actif".

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
**15 a 45 minutes** pour un extract pays selon les ressources du VPS, plus si le serveur est
partage avec d'autres applications gourmandes) ; les demarrages suivants reutilisent les
donnees deja importees dans le volume `nominatim-data`, sans reimporter. Suivre la progression :

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
   (reutilise le pilote OSM de GDAL pour extraire les polygones `boundary=administrative`) -
   necessite `psql`/`ogr2ogr` installes sur l'hote (voir [Prerequis](#1-prerequis)) :
   ```bash
   DATABASE_URL="postgresql://geosm:<MOT_DE_PASSE>@localhost:${POSTGRES_PORT:-5432}/geosm" \
     PBF_PATH=nominatim-source/region-latest.osm.pbf \
     ./scripts/seed-admin-boundaries.sh
   ```
   **Attention** : `DATABASE_URL` ici doit pointer vers `localhost:<POSTGRES_PORT>` (le port
   publie sur l'hote), **pas** vers `postgres:5432` (nom de service Docker, resolvable
   uniquement depuis l'interieur du reseau Docker) - ce script tourne directement sur l'hote,
   pas dans un conteneur.
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
valide le domaine en interrogeant le DNS public - voir aussi la remarque sur `www.` dans les
[Prerequis](#1-prerequis)) :

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

Si le DNS de `www.` n'est pas encore corrige, demandez le certificat pour le domaine apex
seul (`sudo certbot --apache -d geosm.app`) et etendez-le plus tard sans tout refaire :
`sudo certbot --expand -d geosm.app -d www.geosm.app`.

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

### Sous-domaines pour les outils d'observabilite (Grafana/Prometheus/Jaeger/Graylog)

Les 4 services de la [stack d'observabilite](#stack-dobservabilite) sont deployes en prod
lies uniquement a `127.0.0.1` (`docker-compose.prod.yml`), donc injoignables depuis
l'exterieur du VPS par defaut - jusqu'ici la seule facon d'y acceder etait un tunnel SSH.
Cette section les expose chacun sur son propre sous-domaine, comme le reste de l'application.

**Important - Prometheus et Jaeger n'ont pas d'authentification integree** (contrairement a
Grafana et Graylog, qui ont leur propre ecran de connexion). Sans protection supplementaire,
n'importe qui connaissant l'URL pourrait consulter toutes les metriques/traces de l'API. Le
bloc ci-dessous ajoute une authentification basique Apache pour ces deux-la uniquement.

**1. Creer les 4 enregistrements DNS** (chez votre registrar/fournisseur DNS - a faire avant
Certbot, qui valide chaque sous-domaine en interrogeant le DNS public) :

| Type | Nom | Valeur |
|---|---|---|
| A | `grafana.geosm.app` | IP du VPS |
| A | `prometheus.geosm.app` | IP du VPS |
| A | `jaeger.geosm.app` | IP du VPS |
| A | `graylog.geosm.app` | IP du VPS |

Verifier avant de continuer :

```bash
dig +short grafana.geosm.app prometheus.geosm.app jaeger.geosm.app graylog.geosm.app
# chaque ligne doit renvoyer l'IP du VPS
```

**2. Definir `PUBLIC_DOMAIN` dans `.env`** (utilise par `docker-compose.prod.yml` pour que
Grafana/Graylog generent leurs propres URL/redirections correctement derriere le proxy) :

```bash
# Dans /opt/geosm/.env
PUBLIC_DOMAIN=geosm.app
```

**3. Creer les identifiants d'authentification basique** (Prometheus + Jaeger uniquement) :

```bash
sudo apt-get install -y apache2-utils   # fournit htpasswd, si pas deja installe
sudo htpasswd -c /etc/apache2/.htpasswd-observability admin
# -c cree le fichier (uniquement au premier utilisateur - omettre -c pour en ajouter d'autres)
```

**4. Creer le virtual host Apache** (`/etc/apache2/sites-available/geosm-observability.conf`) -
un seul fichier, 4 blocs `<VirtualHost>` :

```apacheconf
<VirtualHost *:80>
    ServerName grafana.geosm.app
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/
    ErrorLog ${APACHE_LOG_DIR}/geosm-grafana-error.log
    CustomLog ${APACHE_LOG_DIR}/geosm-grafana-access.log combined
</VirtualHost>

<VirtualHost *:80>
    ServerName prometheus.geosm.app
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:9090/
    ProxyPassReverse / http://127.0.0.1:9090/

    # Prometheus n'a pas d'authentification native - obligatoire ici.
    <Location />
        AuthType Basic
        AuthName "GeOSM Observability"
        AuthUserFile /etc/apache2/.htpasswd-observability
        Require valid-user
    </Location>

    ErrorLog ${APACHE_LOG_DIR}/geosm-prometheus-error.log
    CustomLog ${APACHE_LOG_DIR}/geosm-prometheus-access.log combined
</VirtualHost>

<VirtualHost *:80>
    ServerName jaeger.geosm.app
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:16686/
    ProxyPassReverse / http://127.0.0.1:16686/

    # Jaeger non plus n'a pas d'authentification native - obligatoire ici.
    <Location />
        AuthType Basic
        AuthName "GeOSM Observability"
        AuthUserFile /etc/apache2/.htpasswd-observability
        Require valid-user
    </Location>

    ErrorLog ${APACHE_LOG_DIR}/geosm-jaeger-error.log
    CustomLog ${APACHE_LOG_DIR}/geosm-jaeger-access.log combined
</VirtualHost>

<VirtualHost *:80>
    ServerName graylog.geosm.app
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:9009/
    ProxyPassReverse / http://127.0.0.1:9009/
    ErrorLog ${APACHE_LOG_DIR}/geosm-graylog-error.log
    CustomLog ${APACHE_LOG_DIR}/geosm-graylog-access.log combined
</VirtualHost>
```

```bash
sudo a2enmod proxy proxy_http auth_basic   # auth_basic requis par Prometheus/Jaeger ci-dessus
sudo a2ensite geosm-observability.conf
sudo apache2ctl configtest   # doit afficher "Syntax OK"
sudo systemctl reload apache2
```

**5. Emettre les certificats TLS** (les 4 sous-domaines en une seule commande, plugin Apache -
modifie automatiquement chaque bloc pour ajouter le `:443` + la redirection 80 -> 443) :

```bash
sudo certbot --apache \
  -d grafana.geosm.app \
  -d prometheus.geosm.app \
  -d jaeger.geosm.app \
  -d graylog.geosm.app
# Choisir l'option de redirection automatique HTTP -> HTTPS quand Certbot la propose
```

**6. Recreer les conteneurs Grafana/Graylog** pour qu'ils prennent en compte `PUBLIC_DOMAIN` :

```bash
cd /opt/geosm
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate grafana graylog
```

**7. Verifier** :

```bash
curl -Is https://grafana.geosm.app | head -1     # 200 ou 302 (redirection connexion)
curl -Is https://prometheus.geosm.app | head -1  # 401 sans identifiants, 200 avec
curl -Is https://jaeger.geosm.app | head -1      # 401 sans identifiants, 200 avec
curl -Is https://graylog.geosm.app | head -1     # 200 ou 302
```

Puis dans un navigateur : Grafana et Graylog doivent afficher leur propre ecran de connexion
habituel ; Prometheus et Jaeger doivent d'abord demander les identifiants definis a l'etape 3.

> Le panneau admin du frontend (`OBSERVABILITY_LINKS` /
> `environments/environment.prod.ts::observabilityLinks`) pointe deja vers ces 4 URL - aucune
> action supplementaire cote frontend, juste redeployer normalement si ce n'est pas deja fait.

### Option B - Caddy devant le port du frontend (alternative la plus simple, TLS automatique)

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

## 7. Publier les images Docker sur GitHub (a faire cote GitHub avant de demarrer la stack)

Les images `api`/`frontend` sont construites par GitHub Actions (voir
[CI/CD](#11-cicd-et-deploiement-continu-a-faire-sur-github-avant-ou-apres-le-premier-lancement-manuel))
et publiees sur GHCR (`ghcr.io/geosmfamily/...`). Deux points a verifier **avant** de tenter de
les tirer sur le VPS, sinon `docker compose pull` echoue avec `unauthorized` (message trompeur -
GHCR renvoie la meme erreur que le paquet soit prive OU qu'il n'existe pas, pour ne pas reveler
l'existence d'un paquet prive a un tiers non autorise) :

1. **Le paquet doit exister** : un push sur `main` a-t-il deja declenche `deploy.yml` avec succes
   sur les deux depots ? Verifier dans l'onglet **Actions** de chaque depot.
2. **Le paquet doit etre public** (le plus simple), ou le VPS doit etre authentifie a GHCR :
   - Pour le rendre public : sur la page principale du depot GitHub -> colonne de droite,
     section **Packages** -> cliquer sur le paquet -> **Package settings** (en bas de la page) ->
     **Change visibility** -> **Public**. A faire sur les **deux** depots.
   - Pour garder les paquets prives : generer un Personal Access Token GitHub (scope
     `read:packages`) puis, **specifiquement pour l'utilisateur `deploy`** (pas root, qui a son
     propre `~/.docker/config.json` distinct) :
     ```bash
     sudo -u deploy docker login ghcr.io -u <votre_user_github> -p <TOKEN>
     ```
     Sans ca, le pull manuel en root peut fonctionner (si vous etes connecte en root) mais le
     deploiement automatique SSH (qui se connecte en `deploy`) continuera d'echouer.

## 8. Demarrer la stack complete

```bash
cd /opt/geosm
```

**Ajouter les references d'image dans `.env`** (pas juste en `export`, qui ne persiste que pour
la session shell courante - toute nouvelle connexion SSH perdrait ces variables et ferait
echouer `docker compose` avec `required variable API_IMAGE is missing a value`) :

```bash
echo "API_IMAGE=ghcr.io/geosmfamily/geosm-api-refactor:latest" >> .env
echo "FRONTEND_IMAGE=ghcr.io/geosmfamily/geosm-frontend-refactor:latest" >> .env
```

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Suivre le demarrage (Nominatim prend le plus de temps au premier lancement, voir section 5)
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -a
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
```

`api` et `frontend` dependent de la sante de plusieurs autres services (`nominatim`, `osrm`,
`postgres`...) - tant que ceux-ci ne sont pas `healthy`, `api`/`frontend` restent en statut
`Created` (normal, pas une erreur). Une fois toutes leurs dependances `healthy`, relancer
simplement `docker compose ... up -d` (Compose ne surveille pas les dependances en arriere-plan
tout seul, il faut redemander un `up` pour qu'il les demarre) :

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -a
```

Si un service refuse de demarrer avec une erreur `address already in use` alors que le port
semble libre, ou reste bloque `unhealthy` malgre des logs applicatifs propres, voir la section
[Depannage](#depannage---incidents-reels-et-solutions).

## 9. Initialiser la base de donnees

Le schema Prisma est applique **automatiquement** a chaque demarrage du conteneur `api` (voir
`docker/entrypoint.sh`, qui execute `prisma db push`) - **aucune commande `prisma migrate
deploy` n'est necessaire ni meme utilisee dans ce projet** (ce depot ne maintient pas de dossier
`prisma/migrations` ; `db push` reconcilie directement le schema declare avec la base reelle a
chaque boot). Verifiez simplement dans les logs de demarrage d'`api` que vous voyez bien `The
database is already in sync with the Prisma schema.` sans avertissement de perte de donnees.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api npm run db:seed
```

Ce script cree le compte super admin, la premiere instance (pays), les themes par defaut, et
tente un import OSM initial. **Si l'extension PostgreSQL `hstore` n'est pas encore activee**
(cas d'une base toute neuve), cet import OSM interne au seed echouera silencieusement et
retombera sur un schema de demonstration (donnees factices, pas les vraies donnees du pays) -
symptome : le seed se termine "avec succes" mais la carte n'affiche presque rien de reel une
fois les couches activees. Activez l'extension **avant** de lancer `db:seed` pour eviter ce
repli :

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U geosm -d geosm -c "CREATE EXTENSION IF NOT EXISTS hstore;"
```

**Bucket MinIO** (si pas deja cree par le seed) :

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec minio \
  mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec minio mc mb local/geosm
```

### Importer les vraies donnees OSM applicatives (couches thematiques)

C'est une etape **distincte** de l'import Nominatim/OSRM (section 5) et du mini-import interne
au seed ci-dessus : elle alimente les tables `planet_osm_*` avec les vraies donnees du pays ET
cree/rafraichit le catalogue de couches thematiques affichees sur la carte (Sante, Restauration,
etc.), via l'API :

```bash
# 1. Se connecter avec le compte super admin
curl -s -X POST https://votre-domaine.org/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@votre-domaine.org","password":"<SUPER_ADMIN_PASSWORD>"}'
# Recuperer "accessToken" dans la reponse

# 2. Lancer l'import OSM applicatif (le fichier .pbf, deja telecharge pour Nominatim/OSRM en
#    section 5, est reutilise - le chemin exact depend de votre configuration, generalement
#    /data/<fichier>.osm.pbf a l'interieur du conteneur api)
curl -s -X POST https://votre-domaine.org/api/v1/admin/osm/import \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"pbfPath": "/data/cameroon-latest.osm.pbf"}'
```

**Pourquoi passer par cette route plutot que d'executer `osm2pgsql` directement en shell** :
`ImportOsmDataUseCase` (le code derriere cette route) deplace automatiquement les tables
`planet_osm_*` du schema `public` vers un schema dedie `osm` juste apres l'import
(`ALTER TABLE public.planet_osm_x SET SCHEMA osm`). Prisma ne gere par defaut que le schema
`public` - une fois les tables dans `osm`, elles lui deviennent invisibles et ne sont plus
jamais candidates a une suppression/modification implicite au prochain demarrage du conteneur.
**Un `osm2pgsql` lance directement en shell (hors de cette route) laisse les tables dans
`public`**, ce qui fait echouer le prochain demarrage d'`api` avec une erreur `Use the
--accept-data-loss flag` (Prisma refuse, a raison, de supprimer implicitement des tables
remplies de plusieurs millions de lignes). Voir
[Depannage](#depannage---incidents-reels-et-solutions) si ce cas s'est deja produit.

3. Initialiser les themes par defaut (si pas deja fait par `db:seed`) :
   `POST /api/v1/default-themes/seed`

### Resynchroniser les couches existantes apres un import/reimport

Si des couches existaient deja (par exemple issues du seed initial, avant que les vraies
donnees OSM soient disponibles), leurs tables derivees ne se mettent **pas** a jour toutes
seules quand les donnees brutes `osm.planet_osm_*` changent - il faut les resynchroniser une
par une via `POST /api/v1/instances/:instanceId/layers/:id/resync` (reserve
`SUPER_ADMIN`/`ADMIN_INSTANCE`). Exemple de boucle pour toutes les couches WMS d'une instance :

```bash
INSTANCE_ID="<id de l'instance>"
TOKEN="<access token admin>"
LAYER_IDS=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U geosm -d geosm -t -c "SELECT id FROM layers WHERE instance_id='$INSTANCE_ID' AND source_type='WMS';" \
  | tr -d ' \r' | grep -v '^$')

for id in $LAYER_IDS; do
  echo -n "Resync $id... "
  curl -s -X POST "https://votre-domaine.org/api/v1/instances/$INSTANCE_ID/layers/$id/resync" \
    -H "Authorization: Bearer $TOKEN" -o /dev/null -w "%{http_code}\n"
done
```

Verifiez qu'une couche renvoie bien des donnees apres resynchronisation :

```bash
curl -s "https://votre-domaine.org/api/v1/layers/<layer_id>/features?bbox=<lon_min>,<lat_min>,<lon_max>,<lat_max>&limit=5"
```
La reponse doit contenir des `features` non vides (`"features":[]` = donnees pas encore
synchronisees, ou aucune donnee dans cette zone).

## 10. Checklist de verification post-deploiement

- [ ] `curl https://votre-domaine.org/api/v1/health` -> `200`, tous les services `"status":"up"`
- [ ] `https://votre-domaine.org` charge la carte, le selecteur d'instance liste le(s) pays cree(s)
- [ ] Activer une couche thematique (ex. Sante) affiche bien des points sur la carte, pas une
      carte vide - sinon voir la section resynchronisation ci-dessus
- [ ] Les icones des couches s'affichent (pas d'icone generique/manquante) -
      `curl -I https://votre-domaine.org/api/v1/layers/icons/<un-slug-de-couche>.svg` doit
      renvoyer `200` avec `Content-Type: image/svg+xml`
- [ ] Connexion (email/mot de passe) et connexion OpenStreetMap fonctionnent toutes les deux
- [ ] Une recherche geographique (barre de recherche) renvoie un resultat via Nominatim auto-heberge
- [ ] Un calcul d'itineraire renvoie un trace via OSRM auto-heberge
- [ ] Mapillary (si active) affiche des points de couverture sur une zone connue pour en avoir
      (grande ville) apres un zoom suffisant - voir la note CACHEBUST dans
      [Depannage](#depannage---incidents-reels-et-solutions) si le placeholder
      `__MAPILLARY_TOKEN__` apparait au lieu d'un vrai token dans les requetes reseau
- [ ] `POST /api/v1/admin/backup` declenche bien un backup visible dans MinIO (bucket `geosm`, prefixe `backups/`)
- [ ] Un export (ou tout autre telechargement genere via URL presignee) s'ouvre bien depuis un navigateur **externe au VPS** (pas juste `curl` depuis le serveur) - confirme que le port `MINIO_PUBLIC_PORT` est bien ouvert dans le firewall
- [ ] `https://grafana.geosm.app` affiche l'ecran de connexion Grafana et des metriques recentes
      une fois connecte (voir [sous-domaines d'observabilite](#sous-domaines-pour-les-outils-dobservabilite-grafanaprometheusjaegergraylog))
- [ ] `https://prometheus.geosm.app` demande bien les identifiants d'authentification basique
      avant d'afficher quoi que ce soit (sinon l'auth Apache n'est pas active - a corriger avant
      d'aller plus loin, ces metriques ne doivent pas etre publiques)
- [ ] `https://jaeger.geosm.app` (memes identifiants) affiche des traces recentes pour une
      requete Gemini/OSRM/Nominatim
- [ ] `https://graylog.geosm.app` affiche l'ecran de connexion Graylog et recoit des logs -
      sinon verifier qu'OpenSearch n'a pas ete tue par manque de memoire (voir Depannage)
- [ ] Un email de test (verification ou reinitialisation de mot de passe) arrive bien
- [ ] Le certificat TLS est valide (`https://` sans avertissement navigateur) et se renouvelle automatiquement

---

## Depannage - incidents reels et solutions

Cette section documente chaque probleme reellement rencontre lors du premier deploiement complet
de GeOSM en production (2026-07-09), avec sa cause exacte. Les correctifs correspondants sont
deja integres au code de ce depot - cette section sert de reference si un symptome similaire
reapparait (ex. apres une modification manuelle de `nginx.conf`/`docker-compose.prod.yml`, ou
sur un fork).

### `docker compose up` echoue avec "address already in use" sur un port pourtant libre

**Cause reelle** : dans `docker-compose.prod.yml`, chaque service redefinissait `ports:` pour le
restreindre a `127.0.0.1`. Or Docker Compose **fusionne** les listes `ports:` entre fichiers par
defaut (au lieu de remplacer) - le mapping du fichier de base (`docker-compose.yml`, souvent en
`0.0.0.0` pour un usage dev) et celui du fichier de prod cohabitaient, faisant tenter au meme
conteneur de publier le meme port **deux fois**. La deuxieme tentative entrait en collision avec
la premiere. Symptome caracteristique : un service different echoue a chaque nouvelle tentative
(l'ordre de traitement interne de Docker n'est pas garanti), donnant l'illusion d'un probleme
externe (VPS partage, race condition) alors que la cause etait entierement dans nos propres
fichiers.

**Correctif deja applique** : chaque `ports:` de `docker-compose.prod.yml` utilise maintenant le
tag YAML `ports: !override` (pas juste `ports:`), qui force Compose a **remplacer** la liste du
fichier precedent au lieu de la fusionner. Verification que la config finale n'a aucun doublon :
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config | grep -c "published:"
```
(le compte doit correspondre exactement au nombre de ports reellement voulus, jamais le double).

### Nominatim/OSRM restent bloques `unhealthy` malgre des logs applicatifs propres

**Cause reelle** : les commandes de test de sante utilisaient `wget`, absent des images
`mediagis/nominatim`/`osrm/osrm-backend`. Le service repondait parfaitement (verifiable par
`curl` direct sur son port), mais le test de sante lui-meme echouait avec `wget: not found`,
marquant le conteneur `unhealthy` en boucle - et bloquant par ricochet `api`/`frontend`, qui en
dependent.

**Correctif deja applique** : les tests de sante utilisent maintenant `bash -c
':> /dev/tcp/localhost/<port>'` (fonctionnalite integree a bash, pas un binaire externe a
installer) plutot que `wget`. Verifiez toujours qu'un outil de test de sante est reellement
present dans l'image avant de l'utiliser :
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec <service> sh -c "which wget curl bash nc 2>&1"
```

### `api` refuse de demarrer avec "Use the --accept-data-loss flag"

**Cause reelle** : un `osm2pgsql` lance directement en shell (au lieu de passer par
`POST /admin/osm/import`) laisse les tables `planet_osm_*` dans le schema `public`, que Prisma
essaie alors de reconcilier avec son schema declare (qui ne les connait pas) au demarrage
suivant d'`api` - et propose de les supprimer/modifier, ce qu'il refuse sans le flag explicite
`--accept-data-loss` (protection **volontaire** contre la perte de donnees, a ne surtout pas
contourner aveuglement si les tables contiennent de vraies donnees importees).

**Correctif** : toujours passer par `POST /api/v1/admin/osm/import` (voir [section
9](#importer-les-vraies-donnees-osm-applicatives-couches-thematiques)), qui deplace
automatiquement les tables vers le schema `osm` (invisible pour Prisma) apres l'import. Si des
tables sont deja bloquees dans `public` avec de vraies donnees dedans, les deplacer
manuellement avant de relancer `api` :
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres psql -U geosm -d geosm -c "
CREATE SCHEMA IF NOT EXISTS osm;
ALTER TABLE public.planet_osm_point SET SCHEMA osm;
ALTER TABLE public.planet_osm_line SET SCHEMA osm;
ALTER TABLE public.planet_osm_polygon SET SCHEMA osm;
ALTER TABLE public.planet_osm_roads SET SCHEMA osm;
ALTER TABLE public.planet_osm_nodes SET SCHEMA osm;
ALTER TABLE public.planet_osm_ways SET SCHEMA osm;
ALTER TABLE public.planet_osm_rels SET SCHEMA osm;
"
```

### `osm2pgsql --hstore` echoue avec `type "hstore" does not exist`

**Cause reelle** : l'extension PostgreSQL `hstore` n'est pas activee par defaut sur une base
neuve. Voir la commande `CREATE EXTENSION IF NOT EXISTS hstore;` dans la
[section 9](#9-initialiser-la-base-de-donnees) - a executer **avant** tout import OSM.

### Graylog reste `unhealthy`, logs "Connection refused" vers OpenSearch

**Cause reelle** : la limite memoire par defaut d'OpenSearch (512 Mo) est trop juste pour la
distribution complete (tous les plugins charges - alerting, ml, security, sql, knn...), meme
avec un tas Java reduit (`-Xmx256m`). Le noyau Linux tue le processus des qu'il depasse ce
plafond cgroup ("Killed" dans les logs `opensearch`), independamment de la memoire disponible
sur le reste du serveur.

**Correctif deja applique** : la limite est passee a 1536 Mo dans `docker-compose.yml`. Si le
probleme persiste sur un VPS particulierement contraint en RAM, augmenter encore cette valeur
ou desactiver certains plugins OpenSearch non utilises.

### Le token Mapillary reste `__MAPILLARY_TOKEN__` (placeholder litteral) meme apres avoir correctement configure le secret GitHub

**Cause reelle** : le `Dockerfile` frontend injecte le vrai token Mapillary a la place du
placeholder via `RUN --mount=type=secret,id=mapillary_token`. Docker (et le cache GitHub Actions,
`cache-from`/`cache-to: type=gha`) met en cache les layers `RUN` en fonction du **texte** de la
commande, **pas** du contenu du secret monte (choix volontaire de BuildKit, pour ne jamais faire
fuiter un hash de secret dans les metadonnees de cache). Si un premier build a tourne avant que
le secret soit correctement configure (secret absent ou vide), ce layer reste en cache avec le
placeholder toujours present - et des builds ulterieurs, meme apres avoir corrige le secret,
peuvent reutiliser ce meme layer en cache car rien d'autre dans le Dockerfile ne change pour
l'invalider.

**Correctif deja applique** : le `Dockerfile` declare `ARG CACHEBUST=1` et le reference dans la
commande `RUN` d'injection ; `deploy.yml` (frontend) passe `CACHEBUST=${{ github.run_id }}-${{
github.run_attempt }}` (une valeur unique a chaque run CI) via `build-args`, forcant ce layer
precis a toujours etre recalcule. Verification directe que le vrai token est bien present dans
le bundle servi (ne pas se fier uniquement a l'onglet Reseau du navigateur, qui peut afficher une
requete perimee restee dans le journal - videz-le avant de retester) :
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec frontend \
  sh -c "grep -l 'mapillaryToken\|MAPILLARY_TOKEN' /usr/share/nginx/html/*.js"
# Puis, sur le fichier trouve :
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec frontend \
  sh -c "grep -o '.\{0,20\}mapillaryToken.\{0,80\}' /usr/share/nginx/html/<fichier-trouve>.js"
```

### Les icones de couches ou une couche WMS renvoient un 404 generique nginx (pas une erreur JSON de l'API)

**Cause reelle** : `nginx.conf` (frontend) avait une location regex `location ~*
\.(js|css|...|svg|...)$` pour mettre en cache les assets statiques. En nginx, les locations
**regex** sont toujours prioritaires sur les locations **prefixe** simples comme `location
/api/`, quel que soit l'ordre d'ecriture dans le fichier. Toute URL sous `/api/` se terminant par
une extension de cette liste (ex. `/api/v1/layers/icons/xxx.svg`) etait donc interceptee par le
bloc de cache statique au lieu d'etre relayee vers l'API - nginx cherchait alors un fichier `.svg`
inexistant sur son propre disque, d'ou un 404 **generique nginx** (page HTML "404 Not Found",
`Server: nginx`), pas l'erreur JSON `{"error":"Icon not found"}` que renverrait l'API elle-meme.
Meme mecanisme potentiel pour toute route API future se terminant par une de ces extensions.

**Correctif deja applique** : `location /api/` et `location /ows` utilisent maintenant le
modificateur `^~` (`location ^~ /api/`), qui leur donne la priorite sur les locations regex des
qu'ils correspondent, sans meme evaluer les regles suivantes.

### `docker compose build frontend` (ou `--no-cache`) ne fait rien, aucune sortie

**Cause reelle** : le service `frontend` n'a pas de cle `build:` dans `docker-compose.yml`
(contrairement a `api`, qui a `build: .`) - il n'existe que via `image:`, pulled depuis GHCR. Il
n'y a donc rien a construire localement sur le VPS pour ce service.

**A retenir** : le depot frontend n'etant pas clone sur le VPS (voir [section
3](#3-cloner-le-depot-backend-sur-le-vps)), toute modification du frontend (nginx.conf,
Dockerfile, code Angular...) ne peut atteindre la production que via le pipeline normal
(commit + push -> CI GitHub Actions -> GHCR -> `docker compose pull frontend` sur le VPS), jamais
via un build local.

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
| `MAPILLARY_TOKEN` (secret GitHub Actions, depot **frontend**) | Regenere depuis mapillary.com/dashboard/developers | Ne prend effet qu'au prochain build/deploiement frontend (le token est bake dans le bundle au build, pas lu au runtime) - voir la note CACHEBUST dans [Depannage](#depannage---incidents-reels-et-solutions) si le nouveau token ne semble pas pris en compte |
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
Interface : `https://jaeger.geosm.app` (authentification basique Apache - voir
[sous-domaines d'observabilite](#sous-domaines-pour-les-outils-dobservabilite-grafanaprometheusjaegergraylog)).
En local/dev, `http://localhost:16686` sans authentification.

### Logs (Graylog)

Logging Winston applique a l'ensemble des domaines de use-cases (auth, couches, commentaires,
assistant IA, geosignets, sauvegardes...), avec `requestId` de correlation. Niveau configurable
via `LOG_LEVEL` (recommande : `info` en production). Les erreurs frontend non gerees remontent
aussi via `POST /logs/frontend-error` (voir `GlobalErrorHandler` Angular). Si Graylog ne recoit
jamais rien, voir la note OpenSearch dans [Depannage](#depannage---incidents-reels-et-solutions).

### Alerting

- **Slack** : `SLACK_WEBHOOK_URL` - utilise pour les nouveaux signalements (formulaire "Infos")
  et les incidents critiques
- **Email** : `ALERT_EMAIL_TO` - reserve aux alertes de niveau critique

#### Alerting Grafana (metriques)

En plus des alertes applicatives ci-dessus, Grafana peut alerter directement sur les metriques
Prometheus (taux d'erreur, jobs en echec, latence...). Le point de contact combine Slack + email
est deja provisionne automatiquement (`monitoring/grafana/provisioning/alerting/`) et reutilise
`SLACK_WEBHOOK_URL`/`ALERT_EMAIL_TO` sans dupliquer ces secrets (lus via la macro Grafana
`$__env{...}`, jamais ecrits en clair dans les fichiers commit'es).

**Ce qui est deja fait** : point de contact `geosm-notifications` (Slack + email) et politique
de notification par defaut qui y route toute alerte. **Ce qui reste a faire manuellement** : les
regles d'alerte elles-memes (le schema de provisioning Grafana pour les regles est complexe et
n'a pas ete genere en aveugle - la creation via l'interface est plus fiable et donne un apercu
live du seuil).

**Verifier d'abord que le point de contact fonctionne** : Grafana -> Alerting -> Contact points
-> `geosm-notifications` -> bouton "Test" sur chaque receiver (Slack et email separement).

**Creer les regles** : Grafana -> Alerting -> Alert rules -> New alert rule. Suggestions de
depart (memes requetes que les dashboards deja crees) :

| Nom | Requete PromQL | Condition | Duree "for" |
|---|---|---|---|
| Taux d'erreurs 5xx eleve | `sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100` | `> 5` | 5m |
| Latence DB elevee | `histogram_quantile(0.95, sum(rate(db_query_duration_seconds_bucket[5m])) by (le))` | `> 1` | 5m |
| Ratio de cache faible | `sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m]))) * 100` | `< 50` | 10m |
| Jobs en echec | `sum(rate(jobs_failed_total[5m])) by (queue)` | `> 0` | 5m |
| Appels Gemini en echec | `sum(rate(gemini_calls_total{status="error"}[5m]))` | `> 0` | 5m |

Pour chacune : coller la requete dans l'onglet Query (source de donnees Prometheus), definir le
seuil dans l'onglet suivant, `Folder` = `GeOSM Alerts` (creer le dossier si besoin), `Evaluation
group` = nouveau groupe `geosm-alerts` toutes les 1m, `for` selon le tableau, puis dans "Labels
and notifications" laisser la politique par defaut (elle route deja vers
`geosm-notifications`).

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
  curl -X POST https://votre-domaine.org/api/v1/admin/backup \
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

## 11. CI/CD et deploiement continu (a faire sur GitHub, avant OU apres le premier lancement manuel)

Le deploiement automatique est gere par GitHub Actions (`deploy.yml`, sur les deux depots -
backend et frontend, meme structure) :

1. **Tests** : suite complete (backend : vitest + seuil de couverture reel ; frontend : lint +
   `tsc --noEmit` + tests unitaires + suite E2E Playwright)
2. **Build Docker** : construction de l'image
3. **Push GHCR** : `ghcr.io/geosmfamily/geosm-api-refactor:<version>` /
   `ghcr.io/geosmfamily/geosm-frontend-refactor:<version>`, tag `<yyyyMMdd>.<numBuild>` + `latest`
   - Le paquet doit etre **public** (ou le VPS authentifie) pour pouvoir etre tire ensuite - voir
     [section 7](#7-publier-les-images-docker-sur-github-a-faire-cote-github-avant-de-demarrer-la-stack)
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

Si `ssh-copy-id` echoue car l'utilisateur `deploy` n'a pas de mot de passe defini (cas normal -
il ne devrait en avoir besoin d'aucun, l'acces se faisant uniquement par cle), passez par un
compte administrateur existant pour deposer la cle publique :
```bash
cat geosm_deploy_key.pub | ssh <votre_user_admin>@<IP_DU_VPS> \
  "sudo mkdir -p /home/deploy/.ssh && sudo tee -a /home/deploy/.ssh/authorized_keys && \
   sudo chown -R deploy:deploy /home/deploy/.ssh && sudo chmod 700 /home/deploy/.ssh && \
   sudo chmod 600 /home/deploy/.ssh/authorized_keys"
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
| `MAPILLARY_TOKEN` | **Frontend uniquement** | Votre token Mapillary de production (genere sur mapillary.com/dashboard/developers, **jamais** un token deja expose publiquement - voir [section 4](#4-generer-et-renseigner-tous-les-secrets)) - injecte dans l'image au build, jamais lu au runtime |

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
