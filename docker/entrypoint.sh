#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=src/infrastructure/database/prisma/schema.prisma

echo "Starting application..."
exec node dist/server.js
