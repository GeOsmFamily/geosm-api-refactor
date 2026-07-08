#!/usr/bin/env bash
# Télécharge et importe dans PostGIS les tuiles SRTM 30m (format "skadi", mirroir public
# AWS Open Data "elevation-tiles-prod", ex-Mapzen Terrain Tiles - aucune authentification
# requise) couvrant une emprise donnée, pour alimenter le profil altimétrique
# (PostGISService.drapeElevationProfile(), table "srtm").
#
# Usage: import-srtm.sh <minLon> <minLat> <maxLon> <maxLat>
#
# Idempotent : les tuiles déjà téléchargées ne sont pas retéléchargées. Les tuiles absentes
# du mirroir (zones purement océaniques en bord de côte) sont silencieusement ignorées.
set -uo pipefail

MIN_LON="${1:?minLon requis}"
MIN_LAT="${2:?minLat requis}"
MAX_LON="${3:?maxLon requis}"
MAX_LAT="${4:?maxLat requis}"

DATA_DIR="${DATA_DIR:-/data}"
SRTM_DIR="$DATA_DIR/srtm"
mkdir -p "$SRTM_DIR"

# DATABASE_URL contient un paramètre "?schema=public" spécifique à Prisma, que psql/libpq
# (utilisés par raster2pgsql) ne reconnaissent pas ("invalid URI query parameter: schema").
# On le retire pour les appels psql - "public" est de toute façon le search_path par défaut.
PSQL_URL="${DATABASE_URL%%\?*}"

MIN_LON_I=$(awk -v v="$MIN_LON" 'BEGIN { print (v < 0 && v != int(v)) ? int(v) - 1 : int(v) }')
MAX_LON_I=$(awk -v v="$MAX_LON" 'BEGIN { print int(v) }')
MIN_LAT_I=$(awk -v v="$MIN_LAT" 'BEGIN { print (v < 0 && v != int(v)) ? int(v) - 1 : int(v) }')
MAX_LAT_I=$(awk -v v="$MAX_LAT" 'BEGIN { print int(v) }')

echo "Import SRTM pour l'emprise [$MIN_LON, $MIN_LAT, $MAX_LON, $MAX_LAT]"
echo "Grille de tuiles : longitudes $MIN_LON_I..$MAX_LON_I, latitudes $MIN_LAT_I..$MAX_LAT_I"

downloaded=0
skipped=0
missing=0
all_tiles=()

for lat in $(seq "$MIN_LAT_I" "$MAX_LAT_I"); do
  if [ "$lat" -ge 0 ]; then
    lat_prefix="N"; lat_abs=$lat
  else
    lat_prefix="S"; lat_abs=$((-lat))
  fi
  lat_str=$(printf "%s%02d" "$lat_prefix" "$lat_abs")

  for lon in $(seq "$MIN_LON_I" "$MAX_LON_I"); do
    if [ "$lon" -ge 0 ]; then
      lon_prefix="E"; lon_abs=$lon
    else
      lon_prefix="W"; lon_abs=$((-lon))
    fi
    lon_str=$(printf "%s%03d" "$lon_prefix" "$lon_abs")

    tile_name="${lat_str}${lon_str}"
    hgt_path="$SRTM_DIR/${tile_name}.hgt"
    gz_path="$SRTM_DIR/${tile_name}.hgt.gz"

    if [ -f "$hgt_path" ]; then
      skipped=$((skipped + 1))
      all_tiles+=("$hgt_path")
      continue
    fi

    url="https://s3.amazonaws.com/elevation-tiles-prod/skadi/${lat_str}/${tile_name}.hgt.gz"
    if wget -q -O "$gz_path" "$url"; then
      if gunzip -f "$gz_path"; then
        downloaded=$((downloaded + 1))
        all_tiles+=("$hgt_path")
        echo "  téléchargée : $tile_name"
      else
        rm -f "$gz_path"
        missing=$((missing + 1))
      fi
    else
      rm -f "$gz_path"
      missing=$((missing + 1))
    fi
  done
done

echo "Téléchargement terminé : $downloaded nouvelles, $skipped déjà présentes, $missing absentes du mirroir (probablement océan)."

if [ "${#all_tiles[@]}" -eq 0 ]; then
  echo "Aucune tuile disponible pour cette emprise (zone entièrement hors couverture SRTM)."
  exit 0
fi

echo "Activation de l'extension postgis_raster..."
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis_raster;" > /dev/null

# Idempotent au niveau de la BASE (et non du disque) : on compare les tuiles présentes sur
# disque à celles déjà enregistrées dans la table (colonne "filename", ajoutée par -F), pas
# uniquement celles téléchargées lors de CETTE exécution. Sans cela, relancer le script après
# un import DB resté incomplet (ex. table supprimée/recréée, échec partiel) ne réimporterait
# rien puisque les tuiles seraient déjà présentes sur disque.
table_exists=$(psql "$PSQL_URL" -tAc "SELECT to_regclass('public.srtm') IS NOT NULL;")

if [ "$table_exists" = "t" ]; then
  imported_names=$(psql "$PSQL_URL" -tAc "SELECT DISTINCT filename FROM srtm;")
  to_import=()
  for tile_path in "${all_tiles[@]}"; do
    tile_base="$(basename "$tile_path")"
    if ! grep -qxF "$tile_base" <<< "$imported_names"; then
      to_import+=("$tile_path")
    fi
  done

  if [ "${#to_import[@]}" -eq 0 ]; then
    echo "Toutes les tuiles de cette emprise sont déjà importées dans la table 'srtm'."
    exit 0
  fi

  echo "Table 'srtm' existante : ajout de ${#to_import[@]} tuile(s) manquante(s) en base (mode append)..."
  raster2pgsql -a -s 4326 -t 200x200 -F "${to_import[@]}" srtm | psql "$PSQL_URL" -v ON_ERROR_STOP=1 > /dev/null
else
  echo "Premier import : création de la table 'srtm' avec ${#all_tiles[@]} tuile(s)..."
  raster2pgsql -c -s 4326 -t 200x200 -I -C -M -F "${all_tiles[@]}" srtm | psql "$PSQL_URL" -v ON_ERROR_STOP=1 > /dev/null
  # La contrainte d'emprise max ("enforce_max_extent_rast") générée par -C est bornée à
  # l'emprise de CE premier import. Le géoportail est multi-instances (chaque instance peut
  # couvrir un pays/une région différente) et cette même table "srtm" est destinée à accueillir
  # des tuiles pour toutes les instances au fil du temps - une emprise figée dès le premier
  # import bloquerait tout import futur en dehors de cette zone. On la retire : elle n'est
  # qu'une optimisation/sanity-check, pas requise pour ST_Value/ST_Intersects.
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "SELECT DropRasterConstraints('srtm', 'rast', 'extent');" > /dev/null
fi

if [ $? -ne 0 ]; then
  echo "Échec de l'import PostGIS des tuiles SRTM." >&2
  exit 1
fi

echo "Import SRTM terminé."
