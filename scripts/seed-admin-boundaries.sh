#!/usr/bin/env bash
# Pré-remplit la table de référence public.admin_boundaries (limites administratives - pays,
# régions, communes) à partir du MÊME extract .osm.pbf déjà utilisé pour Nominatim/OSRM (voir
# docs/deploiement.md - Auto-hébergement Nominatim et OSRM) : réutilise le pilote OSM de GDAL
# (ogr2ogr) pour extraire les polygones tagués boundary=administrative, plutôt que d'introduire
# une nouvelle source de données externe (GADM ou autre).
#
# admin_boundaries est un modèle Prisma "@@ignore" (voir schema.prisma) - jamais géré par
# "prisma db push" (voir docker/entrypoint.sh), donc ce script est seul responsable de créer la
# table si elle n'existe pas encore.
#
# Idempotent : peut être relancé après une mise à jour de l'extract OSM (les anciennes limites du
# même import ne sont PAS automatiquement supprimées - utiliser TRUNCATE manuellement avant un
# nouvel appel si un remplacement complet est voulu, comme documenté dans le sélecteur admin qui
# propose un mode "remplacer" par niveau administratif pour les imports via l'UI).
#
# Usage: PBF_PATH=/chemin/vers/cameroon-latest.osm.pbf ./scripts/seed-admin-boundaries.sh
set -euo pipefail

export MSYS_NO_PATHCONV=1

PBF_PATH="${PBF_PATH:?Chemin vers le fichier .osm.pbf requis (variable PBF_PATH)}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL requis (connexion Postgres cible)}"

if [ ! -f "$PBF_PATH" ]; then
  echo "Fichier introuvable : $PBF_PATH" >&2
  exit 1
fi

# DATABASE_URL contient "?schema=public" (specifique Prisma) que psql/ogr2ogr ne reconnaissent
# pas - voir le meme retrait dans scripts/import-srtm.sh.
PSQL_URL="${DATABASE_URL%%\?*}"

STAGING_TABLE="admin_boundaries_seed_staging"

echo "Création de la table public.admin_boundaries si nécessaire..."
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "
  CREATE TABLE IF NOT EXISTS public.admin_boundaries (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    admin_level INT,
    geom geometry(MultiPolygon, 4326)
  );
"

echo "Extraction des limites administratives (boundary=administrative) depuis $PBF_PATH..."
# postgresql://user:password@host:port/dbname -> "host=... port=... user=... password=... dbname=..."
# (meme format que Ogr2OgrService.getPgConnectionString() cote TypeScript)
PG_NO_SCHEME="${PSQL_URL#postgresql://}"
PG_USERINFO="${PG_NO_SCHEME%%@*}"
PG_USER="${PG_USERINFO%%:*}"
PG_PASSWORD="${PG_USERINFO#*:}"
PG_HOSTPART="${PG_NO_SCHEME#*@}"
PG_HOSTPORT="${PG_HOSTPART%%/*}"
PG_HOST="${PG_HOSTPORT%%:*}"
PG_PORT="${PG_HOSTPORT#*:}"
[ "$PG_PORT" = "$PG_HOST" ] && PG_PORT=5432
PG_DBNAME="${PG_HOSTPART#*/}"

ogr2ogr \
  -f "PostgreSQL" "PG:host=$PG_HOST port=$PG_PORT user=$PG_USER password=$PG_PASSWORD dbname=$PG_DBNAME" \
  "$PBF_PATH" \
  -sql "SELECT name, admin_level FROM multipolygons WHERE boundary='administrative'" \
  -nln "public.$STAGING_TABLE" \
  -overwrite \
  -t_srs EPSG:4326 \
  -lco GEOMETRY_NAME=geom \
  -lco FID=id \
  -progress

echo "Import dans public.admin_boundaries (normalisation MultiPolygon + filtre admin_level numérique)..."
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.admin_boundaries (name, admin_level, geom)
  SELECT name, admin_level::int, ST_Multi(ST_MakeValid(geom))
  FROM public.$STAGING_TABLE
  WHERE name IS NOT NULL
    AND admin_level ~ '^[0-9]+\$'
    AND geom IS NOT NULL;
"

IMPORTED_COUNT=$(psql "$PSQL_URL" -tAc "SELECT COUNT(*) FROM public.admin_boundaries;")

echo "Nettoyage de la table de staging..."
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS public.$STAGING_TABLE;"

echo "Terminé : $IMPORTED_COUNT limite(s) administrative(s) dans public.admin_boundaries."
