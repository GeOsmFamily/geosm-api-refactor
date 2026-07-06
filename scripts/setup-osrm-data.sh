#!/usr/bin/env bash
# Prépare les fichiers .osrm* servis par le conteneur "osrm" de docker-compose.prod.yml
# (osrm-routed ne fait que SERVIR un jeu de données déjà prêt, il ne l'importe jamais
# lui-même). Ce script exécute la préparation en une fois via l'image officielle
# osrm/osrm-backend : extract (lecture du .osm.pbf + profil de routage) -> partition ->
# customize (nécessaires pour l'algorithme MLD utilisé par osrm-routed).
#
# À relancer manuellement à chaque mise à jour significative des données OSM de la région
# (par exemple après un nouvel extract Geofabrik) - ce n'est pas automatisé par un cron,
# contrairement à l'import osm2pgsql applicatif (voir "Import OSM Programmé" dans
# docs/fonctionnalites-detaillees.md), car un changement de réseau routier est bien plus rare
# qu'une mise à jour des couches thématiques.
#
# Usage: PBF_PATH=/chemin/vers/cameroon-latest.osm.pbf ./scripts/setup-osrm-data.sh
set -euo pipefail

# Sous Git Bash (Windows), MSYS convertit automatiquement les chemins absolus de type Unix
# (ex: /opt/car.lua) passes a une commande, ce qui casse les chemins destines a l'INTERIEUR du
# conteneur Docker. Sans effet sur un vrai shell Linux (variable simplement ignoree).
export MSYS_NO_PATHCONV=1

PBF_PATH="${PBF_PATH:?Chemin vers le fichier .osm.pbf requis (variable PBF_PATH)}"
OSRM_DATA_DIR="${OSRM_DATA_DIR:-./osrm-data}"
OSRM_PROFILE="${OSRM_PROFILE:-car}" # profils fournis par l'image : car, bicycle, foot

if [ ! -f "$PBF_PATH" ]; then
  echo "Fichier introuvable : $PBF_PATH" >&2
  exit 1
fi

mkdir -p "$OSRM_DATA_DIR"
# pwd -W (Git Bash/MSYS uniquement) renvoie un chemin Windows natif (C:/Users/...), nécessaire
# pour que le CLI Docker natif interprète correctement le côté HOTE d'un bind mount - un chemin
# POSIX (/c/Users/...) y est mal interprété. Sur un vrai Linux, `pwd -W` échoue et on retombe
# sur `pwd` classique.
PBF_ABS_DIR="$(cd "$(dirname "$PBF_PATH")" && { pwd -W 2>/dev/null || pwd; })"
PBF_FILENAME="$(basename "$PBF_PATH")"
OSRM_ABS_DIR="$(cd "$OSRM_DATA_DIR" && { pwd -W 2>/dev/null || pwd; })"

echo "Copie de l'extract source dans $OSRM_DATA_DIR (osrm-extract écrit ses fichiers .osrm* à côté du .osm.pbf)..."
cp -f "$PBF_ABS_DIR/$PBF_FILENAME" "$OSRM_ABS_DIR/region-latest.osm.pbf"

echo "Étape 1/3 : osrm-extract (profil $OSRM_PROFILE)..."
docker run --rm -v "$OSRM_ABS_DIR:/data" osrm/osrm-backend \
  osrm-extract -p "/opt/${OSRM_PROFILE}.lua" /data/region-latest.osm.pbf

echo "Étape 2/3 : osrm-partition..."
docker run --rm -v "$OSRM_ABS_DIR:/data" osrm/osrm-backend \
  osrm-partition /data/region-latest.osrm

echo "Étape 3/3 : osrm-customize..."
docker run --rm -v "$OSRM_ABS_DIR:/data" osrm/osrm-backend \
  osrm-customize /data/region-latest.osrm

rm -f "$OSRM_ABS_DIR/region-latest.osm.pbf"

echo "Préparation terminée. Fichiers générés dans $OSRM_DATA_DIR :"
ls -la "$OSRM_ABS_DIR"/region-latest.osrm*
echo "Démarrer/redémarrer le service 'osrm' de docker-compose.prod.yml pour prendre en compte ces données."
