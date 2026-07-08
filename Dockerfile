# Stage 1: Builder
FROM node:26-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx prisma generate --schema=src/infrastructure/database/prisma/schema.prisma
RUN npm run build

# Stage 2: Production
FROM node:26-bookworm-slim AS production

# Le dépôt Debian bookworm par défaut ne fournit que postgresql-client 15, alors que
# docker-compose.yml utilise postgis:16-3.4 - pg_dump refuse par sécurité de dumper un serveur
# plus récent que lui-même ("aborting because of server version mismatch"), confirmé en testant
# réellement un backup plutôt qu'en supposant la version du paquet par défaut. On ajoute donc
# le dépôt officiel PGDG pour installer postgresql-client-16 (aligné sur le serveur).
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    python3 \
    python3-qgis \
    osm2pgsql \
    wget \
    unzip \
    zip \
    ca-certificates \
    gnupg \
  && install -d /usr/share/postgresql-common/pgdg \
  && wget --quiet -O /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update && apt-get install -y --no-install-recommends \
    postgis \
    postgresql-client-16 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# L'arborescence src/ complete (pas juste le schema Prisma) est necessaire car prisma/seed.ts
# est execute directement via "tsx" (pas depuis dist/ compile) et importe une dizaine de
# fichiers sous src/application/ et src/infrastructure/ - une copie plus etroite fait echouer
# "npm run db:seed" en production avec ERR_MODULE_NOT_FOUND (verifie en conditions reelles).
COPY tsconfig.json ./
COPY src/ ./src/
COPY python_scripts/ ./python_scripts/
COPY prisma/ ./prisma/
COPY scripts/ ./scripts/
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN sed -i 's/\r$//' ./docker/entrypoint.sh ./scripts/*.sh && chmod +x ./docker/entrypoint.sh ./scripts/*.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

RUN mkdir -p /data /projects /projects/icons /qgis-styles && \
    chown -R appuser:appgroup /app /data /projects /qgis-styles

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["./docker/entrypoint.sh"]
