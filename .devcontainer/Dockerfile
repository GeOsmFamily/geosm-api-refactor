# Image de developpement (VS Code Dev Containers / GitHub Codespaces) - distincte du Dockerfile
# de production a la racine du depot. Objectif different : ici on veut TOUS les outils utiles a
# un contributeur (devDependencies, shell, editeurs de log...) et pas une image minimale, donc
# les deux Dockerfile divergent volontairement plutot que de forcer un unique fichier a servir
# les deux usages.
#
# La liste de paquets systeme ci-dessous doit rester alignee avec le stage "production" du
# Dockerfile racine (GDAL/QGIS/osm2pgsql/chromium sont necessaires aux memes fonctionnalites en
# dev qu'en prod : import raster, import OSM, PDF des rapports d'analyse IA, plans de
# localisation PyQGIS) - si vous ajoutez une dependance systeme a l'un des deux fichiers, pensez
# a l'autre.
FROM node:26-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    python3 \
    python3-qgis \
    osm2pgsql \
    osmium-tool \
    wget \
    curl \
    unzip \
    zip \
    git \
    ca-certificates \
    gnupg \
    chromium \
  && install -d /usr/share/postgresql-common/pgdg \
  && wget --quiet -O /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update && apt-get install -y --no-install-recommends \
    postgis \
    postgresql-client-16 \
  && rm -rf /var/lib/apt/lists/*

# Meme raison que le Dockerfile de production : pointe puppeteer-core (ReportRendererService,
# rapports d'analyse IA en PDF) sur le Chromium installe par apt plutot que d'en telecharger un
# second exemplaire a l'installation npm.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN mkdir -p /data /projects /qgis-styles

# Meme chemin que "workspaceFolder" dans devcontainer.json - le definir ici aussi permet a
# "docker compose exec app <commande>" de fonctionner sans VS Code (CI locale, depannage),
# pas seulement depuis le terminal integre de VS Code qui s'y place deja automatiquement.
WORKDIR /workspace

# Tourne en root (pas de USER dedie ici, contrairement au Dockerfile de production) : ce
# conteneur est jetable et local a chaque contributeur, jamais expose - le simplifier evite les
# problemes de permissions sur les volumes montes (bind mount du depot, volumes nommes
# Postgres/MinIO) qui varient trop d'un système hote a l'autre pour valoir la complexite.
