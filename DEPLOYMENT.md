# Guide de déploiement en production — GeOSM

Ce document explique, étape par étape, comment déployer **l'ensemble du géoportail GeOSM**
(API backend + frontend Angular + base PostGIS + QGIS Server + services annexes) sur un
serveur de production, en partant d'une machine vierge jusqu'à un site accessible en HTTPS
sur un nom de domaine.

Il couvre deux dépôts :
- **Backend** : `geosm-api-refactor` (Fastify + Prisma + PostGIS + QGIS Server)
- **Frontend** : `geosm-frontend-refactor` (Angular 18 + OpenLayers)

> Toutes les commandes shell sont écrites pour un serveur Linux (Debian/Ubuntu). Adaptez si
> vous utilisez une autre distribution.

---

## Table des matières

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Prérequis](#2-prérequis)
3. [Préparer le serveur](#3-préparer-le-serveur)
4. [Récupérer le code](#4-récupérer-le-code)
5. [Configurer les variables d'environnement](#5-configurer-les-variables-denvironnement)
6. [Mettre en place le reverse proxy HTTPS et le frontend](#6-mettre-en-place-le-reverse-proxy-https-et-le-frontend)
7. [Sécuriser le docker-compose de production](#7-sécuriser-le-docker-compose-de-production)
8. [Premier démarrage de la stack](#8-premier-démarrage-de-la-stack)
9. [Initialisation des données (hstore, seed, import OSM)](#9-initialisation-des-données-hstore-seed-import-osm)
10. [Vérification post-déploiement](#10-vérification-post-déploiement)
11. [Sauvegardes](#11-sauvegardes)
12. [Mises à jour de l'application](#12-mises-à-jour-de-lapplication)
13. [Supervision (monitoring)](#13-supervision-monitoring)
14. [Dépannage — incidents réels rencontrés](#14-dépannage--incidents-réels-rencontrés)
15. [Checklist finale de mise en production](#15-checklist-finale-de-mise-en-production)

---

## 1. Vue d'ensemble de l'architecture

```
                                   Internet
                                      │
                                   HTTPS (443)
                                      │
                             ┌────────▼─────────┐
                             │   Caddy (proxy)   │  ← termine le TLS, obtient
                             │  reverse-proxy +  │    le certificat Let's Encrypt
                             │  Let's Encrypt    │    automatiquement
                             └────────┬──────────┘
                                      │  réseau Docker interne
                    ┌─────────────────┼───────────────────┐
                    │                 │                   │
             ┌──────▼──────┐   ┌──────▼──────┐     ┌──────▼───────┐
             │  frontend   │   │     api     │     │  qgis-server │
             │  (nginx +   │──▶│  (Fastify)  │────▶│  (WMS/OWS)   │
             │  Angular)   │   │             │     │              │
             └─────────────┘   └──────┬──────┘     └──────────────┘
                                       │
              ┌────────────┬──────────┼───────────┬─────────────┐
              │            │          │           │             │
        ┌─────▼────┐ ┌─────▼───┐ ┌────▼────┐ ┌────▼─────┐  ┌────▼─────┐
        │ postgres │ │  redis  │ │  minio  │ │meilisearch│ │(monitoring│
        │ +PostGIS │ │ (queue) │ │ (fichiers│ │ (recherche│ │ optionnel)│
        └──────────┘ └─────────┘ │  export) │ │           │ └───────────┘
                                  └──────────┘ └───────────┘
```

Points clés à retenir avant de commencer :
- Le **frontend** est une application Angular compilée en fichiers statiques, servis par
  un conteneur nginx qui fait aussi office de reverse proxy interne vers `/api/` (backend)
  et `/ows` (QGIS Server). C'est ce conteneur qui doit être exposé publiquement (via Caddy).
- Les services `postgres`, `redis`, `minio`, `meilisearch`, `qgis-server` ne doivent
  **jamais** être exposés directement sur Internet — seuls `api` et `frontend` doivent être
  joignables depuis l'extérieur (via Caddy).
- La stack de supervision (Grafana, Prometheus, Jaeger, Graylog, MongoDB, OpenSearch) est
  **optionnelle**. Elle peut être désactivée entièrement au premier déploiement et ajoutée
  plus tard sans rien casser.

---

## 2. Prérequis

- Un serveur Linux avec au minimum **4 vCPU / 8 Go de RAM / 60 Go de disque SSD**
  (la stack complète avec supervision consomme facilement 4-5 Go de RAM au repos ; sans la
  supervision, comptez 2 Go).
- **Docker Engine ≥ 24** et le plugin **Docker Compose v2** (commande `docker compose`,
  pas `docker-compose`).
- Un **nom de domaine** pointant vers l'IP publique du serveur (ex. `geosm.mondomaine.org`)
  via un enregistrement DNS de type `A`. Nécessaire pour obtenir un certificat HTTPS
  automatique avec Caddy.
- Les ports **80** et **443** ouverts sur le pare-feu du serveur (pour Let's Encrypt et le
  trafic HTTPS).
- Un accès SSH avec un utilisateur pouvant exécuter `docker` (membre du groupe `docker`).

Vérifier les prérequis :

```bash
docker --version
docker compose version
```

---

## 3. Préparer le serveur

```bash
# Créer un utilisateur dédié (recommandé, évite de tout faire en root)
sudo adduser geosm
sudo usermod -aG docker geosm
su - geosm

# Installer Docker si nécessaire (Debian/Ubuntu)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Créer l'arborescence de travail
mkdir -p ~/geosm && cd ~/geosm
```

---

## 4. Récupérer le code

Les deux dépôts sont clonés **côte à côte** dans le même dossier parent, car le
`docker-compose.prod.yml` du backend référencera le dossier du frontend comme contexte de
build.

```bash
cd ~/geosm
git clone https://github.com/GeOsmFamily/geosm-api-refactor.git
git clone <URL_DU_DEPOT_FRONTEND> geosm-frontend-refactor

# Arborescence attendue :
# ~/geosm/geosm-api-refactor/
# ~/geosm/geosm-frontend-refactor/
```

---

## 5. Configurer les variables d'environnement

Dans `~/geosm/geosm-api-refactor/` :

```bash
cd ~/geosm/geosm-api-refactor
cp .env.example .env
```

Éditer `.env` et **remplacer impérativement** les valeurs suivantes (ne jamais garder les
valeurs par défaut du dépôt en production) :

| Variable | Rôle | Recommandation |
|---|---|---|
| `NODE_ENV` | Mode d'exécution | `production` |
| `APP_URL` | URL publique de l'API | `https://geosm.mondomaine.org/api` |
| `DATABASE_URL` | Connexion PostgreSQL | changer le mot de passe (voir ci-dessous) |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | générer un secret fort |
| `JWT_ACCESS_SECRET` | Signature des tokens JWT courts | secret aléatoire ≥ 32 caractères |
| `JWT_REFRESH_SECRET` | Signature des tokens JWT longs | secret aléatoire ≥ 32 caractères, **différent** du précédent |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Identifiants du stockage objet | générer des secrets forts |
| `MEILISEARCH_API_KEY` | Clé maître Meilisearch | générer un secret fort |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Compte administrateur créé au premier lancement | vrai e-mail + mot de passe fort |
| `CORS_ORIGIN` | Origine autorisée à appeler l'API | `https://geosm.mondomaine.org` |
| `MAPBOX_ACCESS_TOKEN` | Token pour le fond de carte Mapbox Streets | garder celui fourni, ou mettre le vôtre |
| `GRAFANA_PASSWORD` | Mot de passe admin Grafana | générer un secret fort (si supervision activée) |

Générer des secrets forts rapidement :

```bash
openssl rand -base64 32   # à relancer pour chaque secret (JWT, MinIO, Meilisearch, Postgres...)
```

> **Important** : `DATABASE_URL` doit être cohérent avec `POSTGRES_PASSWORD`. Exemple :
> ```
> POSTGRES_PASSWORD=Xk8pQ2...
> DATABASE_URL=postgresql://geosm:Xk8pQ2...@postgres:5432/geosm?schema=public
> ```

La variable `CORS_ORIGIN` du `.env.example` fourni n'est en réalité utile que si le
frontend et l'API sont servis sur des origines différentes. Avec l'architecture recommandée
dans ce guide (Caddy → frontend nginx → proxy interne `/api/`), le navigateur voit tout sur
la **même origine**, donc le CORS n'est jamais sollicité en pratique — mais gardez la valeur
correcte par sécurité en défense en profondeur.

---

## 6. Mettre en place le reverse proxy HTTPS et le frontend

### 6.1. Vérifier la configuration de build du frontend

Le frontend utilise deux fichiers d'environnement :
- `src/environments/environment.ts` (développement, `apiUrl` pointe vers
  `http://localhost:3005/api/v1`)
- `src/environments/environment.prod.ts` (production, `apiUrl: '/api/v1'`,
  `qgisServerUrl: '/ows'` — chemins **relatifs**, pensés pour être servis derrière le même
  nom de domaine que l'API).

Le build de production (`ng build --configuration production`) substitue automatiquement
`environment.ts` par `environment.prod.ts` grâce à l'entrée `fileReplacements` du
`angular.json`. Rien à faire de plus ici — c'est déjà configuré dans le dépôt.

Le `Dockerfile` du frontend compile l'application puis la sert avec nginx, en proxyfiant
en interne :
- `/api/` → `http://api:3000`
- `/ows` → `http://qgis-server:8080/ows`

Ces deux chemins correspondent exactement à `environment.prod.ts`, donc aucune variable
d'environnement supplémentaire n'est nécessaire côté frontend : tout est résolu au moment du
build.

### 6.2. Créer le Caddyfile

Caddy est utilisé comme unique point d'entrée public : il termine le HTTPS et obtient/renouvelle
automatiquement le certificat Let's Encrypt, sans configuration manuelle de certbot.

Créer `~/geosm/geosm-api-refactor/Caddyfile` :

```caddyfile
geosm.mondomaine.org {
    reverse_proxy frontend:80

    encode gzip

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
    }
}
```

Remplacer `geosm.mondomaine.org` par votre vrai nom de domaine (le DNS doit déjà pointer
vers le serveur pour que Let's Encrypt puisse valider le domaine).

---

## 7. Sécuriser le docker-compose de production

Le `docker-compose.yml` fourni dans le dépôt est pensé pour un usage de **développement
local** : il publie directement sur l'hôte les ports de `postgres` (5432), `redis` (6379),
`minio` (9000/9001), `meilisearch` (7700), `qgis-server` (8380), et toute la stack de
supervision. En production, publier ces ports revient à exposer votre base de données et
votre cache directement sur Internet — à éviter absolument.

Créer un fichier `docker-compose.prod.yml` à côté du `docker-compose.yml` existant. Ce
fichier est un **override** : on ne réécrit pas le fichier de base, on le complète avec
`docker compose -f docker-compose.yml -f docker-compose.prod.yml`.

```yaml
# docker-compose.prod.yml
services:
  # --- Ports internes uniquement : on retire les "ports:" publiés sur 0.0.0.0 ---
  postgres:
    ports: []

  redis:
    ports: []

  minio:
    ports: []

  meilisearch:
    ports: []

  qgis-server:
    ports: []

  # --- Nouveau : frontend Angular, construit depuis le dépôt frontend cloné à côté ---
  frontend:
    build: ../geosm-frontend-refactor
    restart: unless-stopped
    depends_on:
      - api
      - qgis-server
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3

  # --- Nouveau : Caddy, unique point d'entrée public (80/443) ---
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - frontend

  # --- Stack de supervision : désactivée par défaut en production (voir section 13) ---
  # Pour la garder active, ne mettez rien ici ; pour la désactiver complètement,
  # commentez ces services dans docker-compose.yml ou passez par un profil Compose.

volumes:
  caddy-data:
  caddy-config:
```

> **Pourquoi ne pas juste éditer `docker-compose.yml` directement ?** Garder les deux
> fichiers séparés permet de mettre à jour le dépôt (`git pull`) sans jamais entrer en
> conflit avec vos changements de configuration de production.

Si vous préférez **désactiver complètement** la stack de supervision (Grafana, Prometheus,
Jaeger, Graylog, MongoDB, OpenSearch) pour économiser des ressources, ajoutez également dans
`docker-compose.prod.yml` une section qui les neutralise, ou plus simplement commentez ces
6 services directement dans `docker-compose.yml` après le premier `git pull` (ils sont
clairement délimités par le commentaire `# --- Monitoring Stack ---`).

À partir de maintenant, **toutes les commandes `docker compose`** de ce guide doivent être
lancées avec les deux fichiers :

```bash
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
```

(Ajoutez cet alias à votre `~/.bashrc` pour ne pas avoir à le retaper.)

---

## 8. Premier démarrage de la stack

```bash
cd ~/geosm/geosm-api-refactor

# Construire les images (api + frontend)
dc build

# Démarrer tous les services en arrière-plan
dc up -d

# Suivre les logs le temps que tout démarre (Ctrl+C pour sortir, les conteneurs continuent)
dc logs -f
```

Au démarrage du conteneur `api`, `docker/entrypoint.sh` exécute automatiquement
`npx prisma db push` (crée toutes les tables de l'application à partir du schéma Prisma,
ainsi que les extensions PostgreSQL déclarées dans `schema.prisma` : `postgis` et
`uuid-ossp`) puis lance le serveur Fastify. Le serveur crée aussi automatiquement le bucket
MinIO nécessaire au stockage des exports (`ensureBucket()` au démarrage) — **aucune
manipulation manuelle de MinIO n'est requise**.

Vérifier que tous les services sont en bonne santé :

```bash
dc ps
```

Tous les services doivent afficher `healthy` (ou `running` pour ceux sans healthcheck comme
`caddy`/`frontend` juste après le démarrage — attendez ~30 secondes).

---

## 9. Initialisation des données (hstore, seed, import OSM)

Cette étape est **à faire une seule fois**, juste après le tout premier démarrage.

### 9.1. Créer l'extension PostgreSQL `hstore` (obligatoire, avant le seed)

L'extension `hstore` n'est **pas** déclarée dans `schema.prisma` (contrairement à `postgis`
et `uuid-ossp`) car elle n'est utilisée que par l'import OSM (`osm2pgsql --hstore`), pas par
l'application elle-même. Elle doit donc être créée manuellement avant tout import de
données OpenStreetMap :

```bash
dc exec postgres psql -U geosm -d geosm -c "CREATE EXTENSION IF NOT EXISTS hstore;"
```

> **Piège à connaître** : si vous oubliez cette étape, la commande `db:seed` (ci-dessous) ne
> plantera pas franchement — elle **échouera silencieusement sur l'import réel** (l'appel à
> `osm2pgsql --hstore` échoue car le type `hstore` n'existe pas encore en base), puis se
> **rabattra automatiquement sur un jeu de données factice** (quelques points de test en dur
> dans `prisma/seed.ts`) sans le signaler comme une erreur bloquante. Résultat : l'instance
> "Cameroun" se crée avec succès en apparence, mais avec 3-4 objets fictifs au lieu des
> vraies données OpenStreetMap. Si vous constatez ce symptôme après un `db:seed`, exécutez
> la commande `CREATE EXTENSION hstore` ci-dessus puis relancez le seed (il est idempotent
> pour la partie utilisateur admin, mais **supprime et recrée entièrement** l'instance
> "cameroon" à chaque exécution — voir l'avertissement ci-dessous).

### 9.2. Lancer le seed (création complète des données initiales)

`prisma/seed.ts` fait, en une seule commande, **tout le travail d'initialisation** :

1. Télécharge automatiquement l'export OpenStreetMap du Cameroun depuis Geofabrik
   (`cameroon-latest.osm.pbf`, plusieurs dizaines de Mo) dans le volume `/data` du
   conteneur `api`.
2. Importe ces données avec `osm2pgsql --slim --hstore` dans le schéma `public`, puis
   déplace automatiquement les tables `planet_osm_*` produites vers le schéma `osm`
   (`ALTER TABLE ... SET SCHEMA osm`) — **cette étape est cruciale** : si les tables
   `planet_osm_*` restaient dans `public`, le prochain redémarrage du conteneur `api`
   entrerait en boucle de crash, car `prisma db push` détecterait ces tables comme un
   « drift » de schéma non reconnu et refuserait de démarrer sans l'option destructive
   `--accept-data-loss` (voir section 14).
3. Crée le compte super-administrateur avec les identifiants définis dans `.env`
   (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`).
4. Crée l'instance de démonstration **« cameroon »**, génère ses couches par défaut
   (icônes SVG, projet QGIS, tables PostGIS dérivées par couche), ses thématiques et ses
   fonds de carte par défaut.

```bash
dc exec api npm run db:seed
```

Cette opération peut prendre **plusieurs minutes** (téléchargement + import osm2pgsql +
génération des ~46 couches par défaut). Suivez la progression dans le terminal : chaque
étape est journalisée en clair (`console.log`).

> ⚠️ **Attention — commande destructive à ne PAS relancer par erreur** : `db:seed`
> commence par supprimer purement et simplement l'instance `cameroon` existante et son
> schéma PostgreSQL dédié (`DROP SCHEMA IF EXISTS "cameroon" CASCADE`) avant de la
> recréer. Ne relancez **jamais** cette commande sur une instance de production contenant
> des données réelles (couches personnalisées, commentaires utilisateurs, etc.) sans avoir
> fait une sauvegarde complète au préalable (section 11). Elle est prévue pour
> l'initialisation, pas pour une réinitialisation régulière.

### 9.3. Créer d'autres instances géographiques (facultatif)

Si vous souhaitez déployer GeOSM pour un autre pays/une autre zone que le Cameroun, ne
passez pas par `db:seed` (qui est spécifique à la démo Cameroun) : utilisez l'API
d'administration (`POST /api/v1/instances`, rôle `SUPER_ADMIN`, documentée dans Swagger à
`https://geosm.mondomaine.org/api/v1/docs`) pour créer une nouvelle instance, puis
`POST /api/v1/admin/osm/import` avec le chemin d'un fichier `.pbf` déposé au préalable dans
le volume `data-volume` du conteneur `api` (`/data`).

---

## 10. Vérification post-déploiement

```bash
# Santé de l'API
curl -sf https://geosm.mondomaine.org/api/v1/health && echo OK

# QGIS Server répond
curl -sf "https://geosm.mondomaine.org/ows/cameroon?service=WMS&request=GetCapabilities" | head -5

# Frontend accessible
curl -sfI https://geosm.mondomaine.org/ | head -5
```

Ouvrez ensuite `https://geosm.mondomaine.org` dans un navigateur :
1. La carte doit se charger et se centrer automatiquement sur l'emprise de l'instance
   Cameroun.
2. Connectez-vous avec les identifiants `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` définis
   dans `.env`.
3. Activez une couche du catalogue (ex. « Hôpitaux ») et vérifiez que des marqueurs/clusters
   apparaissent avec de vraies données au clic (pas de fiche vide).

---

## 11. Sauvegardes

### 11.1. Base de données PostgreSQL (la plus critique)

```bash
# Sauvegarde complète (schéma applicatif + schéma osm + toutes les instances)
dc exec -T postgres pg_dump -U geosm -d geosm --format=custom > geosm_$(date +%F).dump

# Restauration (sur une base vide)
dc exec -T postgres pg_restore -U geosm -d geosm --clean --if-exists < geosm_2026-07-01.dump
```

Automatiser avec une tâche cron quotidienne :

```bash
crontab -e
# Sauvegarde tous les jours à 3h du matin, conservée 14 jours
0 3 * * * cd ~/geosm/geosm-api-refactor && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres pg_dump -U geosm -d geosm --format=custom > ~/backups/geosm_$(date +\%F).dump && find ~/backups -name "geosm_*.dump" -mtime +14 -delete
```

### 11.2. Fichiers MinIO (exports générés par les utilisateurs)

```bash
# Le volume Docker nommé minio-data contient les objets bruts
docker run --rm -v geosm-api-refactor_minio-data:/data -v ~/backups:/backup \
  alpine tar czf /backup/minio_$(date +%F).tar.gz -C /data .
```

(Le nom exact du volume dépend du nom du dossier du projet — vérifiez avec
`docker volume ls | grep minio-data`.)

### 11.3. Projets QGIS et styles

```bash
docker run --rm -v geosm-api-refactor_qgis-projects:/data -v ~/backups:/backup \
  alpine tar czf /backup/qgis-projects_$(date +%F).tar.gz -C /data .
```

---

## 12. Mises à jour de l'application

```bash
cd ~/geosm/geosm-api-refactor
git pull

cd ~/geosm/geosm-frontend-refactor
git pull

cd ~/geosm/geosm-api-refactor
dc build
dc up -d
```

`prisma db push` s'exécute automatiquement à chaque redémarrage du conteneur `api` via
`entrypoint.sh` — les nouvelles migrations de schéma (nouvelles colonnes, nouvelles tables)
sont donc appliquées automatiquement au redémarrage. **Ne lancez jamais `npm run db:seed`
lors d'une mise à jour** (voir l'avertissement de la section 9.2) : le seed est réservé au
tout premier déploiement.

En cas de problème après une mise à jour, revenir à la version précédente :

```bash
git log --oneline -5   # repérer le commit précédent
git checkout <commit_precedent>
dc build && dc up -d
```

---

## 13. Supervision (monitoring)

La stack de supervision (`grafana`, `prometheus`, `jaeger`, `graylog`, `mongodb`,
`opensearch`) est incluse dans `docker-compose.yml` mais reste optionnelle. Si vous
l'activez en production :

- **Ne l'exposez pas publiquement sans authentification.** Le `docker-compose.prod.yml` de
  la section 7 retire déjà la publication directe des ports (`3001` Grafana, `9090`
  Prometheus, `16686` Jaeger, `9009` Graylog). Pour y accéder, utilisez un tunnel SSH plutôt
  que de les exposer via Caddy :
  ```bash
  ssh -L 3001:localhost:3001 geosm@geosm.mondomaine.org
  # puis ouvrir http://localhost:3001 sur votre machine locale
  ```
  (Cela suppose de republier `3001:3000` uniquement sur `127.0.0.1` dans
  `docker-compose.prod.yml` si vous voulez y accéder ainsi : `ports: ["127.0.0.1:3001:3000"]`.)
- Changez impérativement `GRAFANA_PASSWORD` dans `.env` (section 5).
- Si vous n'avez pas besoin de traces distribuées / logs centralisés, désactivez
  entièrement ces 6 services pour économiser des ressources (voir note en section 7) — le
  reste de l'application fonctionne parfaitement sans eux, les métriques Prometheus internes
  (`PROMETHEUS_ENABLED`) et les logs restent disponibles via `dc logs api`.

---

## 14. Dépannage — incidents réels rencontrés

Cette section documente des incidents concrets rencontrés pendant le développement de
l'application, pour éviter de perdre du temps à les re-diagnostiquer en production.

### 14.1. Le conteneur `api` boucle en crash-loop après un import OSM manuel

**Symptôme** : `dc ps` montre `api` en redémarrage permanent ; `dc logs api` montre
`prisma db push` qui échoue en signalant des tables inconnues (`planet_osm_point`,
`planet_osm_line`, etc.) et refuse de continuer sans `--accept-data-loss`.

**Cause** : des tables `planet_osm_*` ont été créées par `osm2pgsql` directement dans le
schéma `public` (comportement par défaut d'osm2pgsql si aucun schéma n'est précisé côté
connexion) au lieu du schéma `osm` isolé, dans lequel l'application attend de les trouver.
Prisma, qui gère le schéma `public`, voit alors des tables qu'il ne connaît pas et les
signale comme un drift.

**Ne jamais faire** : relancer `prisma db push --accept-data-loss` pour « débloquer »
rapidement la situation — cela **supprime les tables non reconnues**, donc toutes les
données OSM importées.

**Correction sûre** :
```bash
dc exec postgres psql -U geosm -d geosm -c "CREATE SCHEMA IF NOT EXISTS osm;"
dc exec postgres psql -U geosm -d geosm -c "ALTER TABLE public.planet_osm_point SET SCHEMA osm;"
dc exec postgres psql -U geosm -d geosm -c "ALTER TABLE public.planet_osm_line SET SCHEMA osm;"
dc exec postgres psql -U geosm -d geosm -c "ALTER TABLE public.planet_osm_polygon SET SCHEMA osm;"
dc exec postgres psql -U geosm -d geosm -c "ALTER TABLE public.planet_osm_roads SET SCHEMA osm;"
# Puis supprimer les tables "slim" intermédiaires si présentes (nodes/ways/rels), inutiles après import :
dc exec postgres psql -U geosm -d geosm -c "DROP TABLE IF EXISTS public.planet_osm_nodes, public.planet_osm_ways, public.planet_osm_rels;"
dc restart api
```
En pratique, ce problème ne devrait pas se produire si vous utilisez `npm run db:seed` ou
la route `POST /admin/osm/import` (toutes deux déplacent automatiquement les tables vers le
schéma `osm` après l'import) — il ne peut survenir que si `osm2pgsql` est exécuté
manuellement en ligne de commande sans reproduire cette étape.

### 14.2. `column "xxxphone" does not exist` lors de la consultation d'une couche

**Cause** : des noms de colonnes OSM contenant des caractères spéciaux (ex. `contact:phone`)
doivent être entourés de guillemets doubles dans le SQL généré dynamiquement, jamais
« assainis » en supprimant les caractères non alphanumériques (ce qui transformerait
`contact:phone` en une colonne `contactphone` inexistante). Ce bug a été corrigé
définitivement côté code (`PostGISService.quoteIdent()`) — mentionné ici uniquement au cas
où une régression similaire réapparaîtrait après une modification future de
`postgis.service.ts`.

### 14.3. Les exports GeoPackage/Shapefile téléchargés ont une mauvaise extension ou sont invalides

**Cause historique (corrigée)** : le frontend utilisait `format.toLowercase()` comme
extension de fichier au lieu de la vraie extension (`.gpkg` pour GeoPackage, `.zip` pour
Shapefile puisqu'un shapefile est un format multi-fichiers `.shp/.shx/.dbf/.prj`). Le worker
d'export ne zippait pas non plus les fichiers compagnons du shapefile. Les deux ont été
corrigés (`export-format.util.ts` côté frontend, `export.worker.ts` côté backend). Si ce
symptôme réapparaît après une modification de ces fichiers, c'est le premier endroit à
vérifier.

### 14.4. Le bucket MinIO n'existe pas / erreurs de stockage au premier démarrage

Ce problème est résolu automatiquement depuis l'ajout de `ensureBucket()` au démarrage du
serveur (`server.ts`) — le bucket configuré par `MINIO_BUCKET` est créé s'il n'existe pas
encore, à chaque démarrage de l'API. Aucune action manuelle requise.

### 14.5. `MINIO_USE_SSL=false` ne semble pas pris en compte

**Cause historique (corrigée)** : `z.coerce.boolean()` de la librairie de validation Zod
convertit **toute chaîne non vide** en `true`, y compris la chaîne littérale `"false"`. Un
validateur explicite (`booleanEnv()` dans `env.config.ts`) a été ajouté pour parser
correctement `MINIO_USE_SSL` et `PROMETHEUS_ENABLED`. Si vous ajoutez vous-même une nouvelle
variable d'environnement booléenne dans `env.config.ts`, utilisez `booleanEnv()` et non
`z.coerce.boolean()`.

### 14.6. Les tuiles de fond de carte ou les couches WMS ne s'affichent pas en production

**Vérifier en premier** : que la route `/ows` est bien proxyfiée par le conteneur
`frontend` vers `qgis-server:8080/ows` (voir section 6.1 / `Dockerfile` du frontend). Sans
ce proxy, `environment.prod.ts` (`qgisServerUrl: '/ows'`) pointe vers une route qui n'existe
nulle part côté serveur web, et toutes les couches WMS échouent silencieusement.

### 14.7. Logs et diagnostic général

```bash
dc logs -f api                 # logs applicatifs en direct
dc logs --tail=200 api         # dernières lignes seulement
dc exec postgres psql -U geosm -d geosm   # console SQL directe
dc exec api sh                 # shell dans le conteneur API
```

---

## 15. Checklist finale de mise en production

- [ ] DNS du domaine pointe vers l'IP du serveur, ports 80/443 ouverts
- [ ] `.env` rempli avec des secrets forts et uniques (JWT, PostgreSQL, MinIO, Meilisearch,
      Grafana), et **jamais** commité dans git
- [ ] `NODE_ENV=production`, `CORS_ORIGIN` pointe vers le vrai domaine
- [ ] `docker-compose.prod.yml` en place : ports internes retirés, services `frontend` et
      `caddy` ajoutés
- [ ] `Caddyfile` créé avec le bon nom de domaine
- [ ] `dc up -d` : tous les services `healthy`
- [ ] `CREATE EXTENSION hstore` exécutée avant le seed
- [ ] `npm run db:seed` exécuté une seule fois, logs vérifiés (vraies données OSM, pas le
      jeu de secours factice)
- [ ] Connexion au compte super-admin réussie depuis le site public
- [ ] Une couche de points affiche des données réelles au clic
- [ ] Export d'une couche (GeoJSON et Shapefile) téléchargé et vérifié
- [ ] Sauvegarde PostgreSQL testée manuellement une première fois (`pg_dump` puis
      `pg_restore` sur une base de test)
- [ ] Tâche cron de sauvegarde quotidienne en place
- [ ] Mot de passe Grafana changé si la supervision est activée, et non exposée publiquement
