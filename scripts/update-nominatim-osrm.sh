#!/usr/bin/env bash
# Script d'action post-import OSM déclenché par GeOSM Backend (OSM_POST_IMPORT_SCRIPT)
#
# Prise en compte de la base existante (Cameroun) et des nouvelles instances (Mali, etc.) :
# 1. Conserve tous les fichiers PBF téléchargés dans DATA_DIR.
# 2. Si plusieurs PBF existent, les fusionne avec osmium en un PBF unique.
# 3. Met à jour OSRM sur l'ensemble du territoire couvert.
# 4. Ajoute les données à la base Nominatim existante via 'nominatim add-data' (sans écraser le Cameroun).

set -euo pipefail

NEW_PBF_PATH="${1:-}"
DATA_DIR="${2:-./data}"

echo "=== Début de la mise à jour automatique Nominatim & OSRM ==="
echo "Fichier PBF reçu : ${NEW_PBF_PATH:-Aucun}"
echo "Dossier des données : $DATA_DIR"

mkdir -p "$DATA_DIR"

# 1. Lister tous les fichiers .osm.pbf sources (exclure le fichier fusionné temporaire)
PBF_FILES=()
while IFS= read -r -d '' file; do
  PBF_FILES+=("$file")
done < <(find "$DATA_DIR" -maxdepth 1 -name "*.osm.pbf" ! -name "combined-region.osm.pbf" -print0 2>/dev/null || true)

COUNT=${#PBF_FILES[@]}
COMBINED_PBF="$DATA_DIR/combined-region.osm.pbf"

if [ "$COUNT" -eq 0 ]; then
  if [ -n "$NEW_PBF_PATH" ] && [ -f "$NEW_PBF_PATH" ]; then
    TARGET_PBF="$NEW_PBF_PATH"
  else
    echo "Aucun fichier .osm.pbf trouvé dans $DATA_DIR"
    exit 0
  fi
elif [ "$COUNT" -eq 1 ]; then
  TARGET_PBF="${PBF_FILES[0]}"
  echo "Un seul fichier PBF détecté : $TARGET_PBF"
else
  echo "$COUNT fichiers PBF détectés dans $DATA_DIR :"
  for f in "${PBF_FILES[@]}"; do
    echo "  - $f"
  done
  echo "Fusion des données OSM (Cameroun + nouvelles instances) vers $COMBINED_PBF..."
  
  if command -v osmium &> /dev/null; then
    osmium merge "${PBF_FILES[@]}" -o "$COMBINED_PBF" --overwrite
  else
    echo "Utilisation de l'image Docker stefda/osmium-tool pour la fusion..."
    DATA_ABS_DIR="$(cd "$DATA_DIR" && { pwd -W 2>/dev/null || pwd; })"
    DOCKER_ARGS=()
    for f in "${PBF_FILES[@]}"; do
      DOCKER_ARGS+=("/data/$(basename "$f")")
    done
    docker run --rm -v "$DATA_ABS_DIR:/data" stefda/osmium-tool \
      osmium merge "${DOCKER_ARGS[@]}" -o /data/combined-region.osm.pbf --overwrite
  fi
  TARGET_PBF="$COMBINED_PBF"
  echo "Fusion réalisée avec succès."
fi

# 2. Mise à jour d'OSRM (Moteur de routage unique)
echo "=== 1/3 : Mise à jour du conteneur OSRM ==="
if [ -f "./scripts/setup-osrm-data.sh" ]; then
  PBF_PATH="$TARGET_PBF" ./scripts/setup-osrm-data.sh || echo "Avertissement: échec partiel de setup-osrm-data.sh"
fi

if docker ps --format '{{.Names}}' | grep -q "^osrm$"; then
  echo "Redémarrage du conteneur OSRM..."
  docker restart osrm || true
fi

# 3. Mise à jour de Nominatim (Moteur de géocodage unique)
echo "=== 2/3 : Mise à jour du conteneur Nominatim ==="
if docker ps --format '{{.Names}}' | grep -q "^nominatim$"; then
  TARGET_FILENAME="$(basename "$TARGET_PBF")"
  echo "Ajout incrémental des données dans Nominatim via add-data..."
  # Tente l'ajout incrémental 'add-data' pour préserver les données existantes, fallback vers import si base vierge
  if ! docker exec -i nominatim nominatim add-data --file "/data/$TARGET_FILENAME"; then
    echo "Fallback vers 'nominatim import'..."
    docker exec -i nominatim nominatim import --osm-file "/data/$TARGET_FILENAME" --drop || true
  fi
  docker exec -i nominatim nominatim index || true
  docker restart nominatim || true
fi

# 4. Rafraîchissement de public.admin_boundaries (limites administratives affichées sur la
# carte/le sélecteur admin) - $TARGET_PBF est ici TOUJOURS le .pbf pays/fusionné (jamais un
# extract découpé sur la bbox d'une seule instance), condition nécessaire pour que les relations
# de limite administrative restent complètes (voir avertissement dans seed-admin-boundaries.sh -
# une géométrie tronquée par découpe produit des bordures rectilignes au lieu du contour réel).
echo "=== 3/3 : Rafraîchissement des limites administratives (admin_boundaries) ==="
if [ -f "./scripts/seed-admin-boundaries.sh" ] && [ -n "${DATABASE_URL:-}" ]; then
  PBF_PATH="$TARGET_PBF" DATABASE_URL="$DATABASE_URL" ./scripts/seed-admin-boundaries.sh \
    || echo "Avertissement: échec du rafraîchissement de admin_boundaries"
else
  echo "Ignoré (script absent ou DATABASE_URL non défini)"
fi

echo "=== Mise à jour Nominatim & OSRM terminée avec succès ==="
