#!/usr/bin/env bash
set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-geosm}"
DB_NAME="${DB_NAME:-geosm_test}"
DB_PASSWORD="${DB_PASSWORD:-geosm_test_secret}"

export PGPASSWORD="$DB_PASSWORD"

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready."

# Run Prisma migrations
echo "Running Prisma migrations..."
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
npx prisma migrate deploy --schema=src/infrastructure/database/prisma/schema.prisma

# Enable PostGIS extension if not already enabled
echo "Enabling PostGIS extension..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
  'CREATE EXTENSION IF NOT EXISTS postgis;'
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'

# Seed test data
echo "Creating test seed data..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'SQL'
-- Test instance
INSERT INTO instances (id, name, slug, description, bbox, default_zoom, is_active, created_at, updated_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Test Instance',
  'test-instance',
  'Instance for integration tests',
  ARRAY[-180, -90, 180, 90],
  6,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Test user (password: "TestPassword123!")
-- Hash generated with bcrypt, 10 rounds
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, email_verified_at, created_at, updated_at)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'test@geosm.org',
  '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36PQm2Pro0Y9vl/dGMGn6pW',
  'Test',
  'User',
  'SUPER_ADMIN',
  true,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Link test user to test instance
INSERT INTO instance_users (id, user_id, instance_id, role, created_at, updated_at)
VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'ADMIN_INSTANCE',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, instance_id) DO NOTHING;
SQL

echo "Test database setup complete."
