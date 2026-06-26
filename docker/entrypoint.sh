#!/bin/sh
set -e

echo "Applying database schema..."
npx prisma db push --schema=src/infrastructure/database/prisma/schema.prisma --skip-generate

echo "Starting application..."
exec node dist/server.js
