# Stage 1: Builder
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx prisma generate --schema=src/infrastructure/database/prisma/schema.prisma
RUN npm run build

# Stage 2: Production
FROM node:22-bookworm-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    python3 \
    python3-qgis \
    osm2pgsql \
    wget \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY src/infrastructure/database/prisma/ ./src/infrastructure/database/prisma/
COPY python_scripts/ ./python_scripts/
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN sed -i 's/\r$//' ./docker/entrypoint.sh && chmod +x ./docker/entrypoint.sh

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
