#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ERRORS=0

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; ERRORS=$((ERRORS + 1)); }

echo "=== Docker Configuration Validation ==="
echo ""

# 1. Check Dockerfile exists and has required stages
echo "[Dockerfile]"
if [ -f "$PROJECT_DIR/Dockerfile" ]; then
  pass "Dockerfile exists"
  if grep -q "AS builder" "$PROJECT_DIR/Dockerfile"; then
    pass "Builder stage found"
  else
    fail "Builder stage not found"
  fi
  if grep -q "AS production" "$PROJECT_DIR/Dockerfile"; then
    pass "Production stage found"
  else
    fail "Production stage not found"
  fi
  if grep -q "HEALTHCHECK" "$PROJECT_DIR/Dockerfile"; then
    pass "Healthcheck defined"
  else
    fail "No healthcheck in Dockerfile"
  fi
  if grep -q "USER" "$PROJECT_DIR/Dockerfile"; then
    pass "Non-root user configured"
  else
    fail "No non-root user configured"
  fi
  if grep -q "EXPOSE" "$PROJECT_DIR/Dockerfile"; then
    pass "Port exposed"
  else
    fail "No port exposed"
  fi
else
  fail "Dockerfile not found"
fi

echo ""

# 2. Check docker-compose.yml
echo "[docker-compose.yml]"
COMPOSE="$PROJECT_DIR/docker-compose.yml"
if [ -f "$COMPOSE" ]; then
  pass "docker-compose.yml exists"

  # Validate syntax (basic YAML check)
  if command -v docker > /dev/null 2>&1 && docker compose version > /dev/null 2>&1; then
    # Create temporary .env if missing so compose config can validate
    CREATED_ENV=false
    if [ ! -f "$PROJECT_DIR/.env" ] && [ -f "$PROJECT_DIR/.env.example" ]; then
      cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
      CREATED_ENV=true
    fi
    if docker compose -f "$COMPOSE" config > /dev/null 2>&1; then
      pass "docker-compose.yml is valid YAML"
    else
      fail "docker-compose.yml has syntax errors"
    fi
    if [ "$CREATED_ENV" = true ]; then
      rm -f "$PROJECT_DIR/.env"
    fi
  else
    echo "  SKIP: docker compose not available for validation"
  fi

  # Check required services
  for svc in api postgres redis minio meilisearch qgis-server; do
    if grep -q "^  ${svc}:" "$COMPOSE"; then
      pass "Service '$svc' defined"
    else
      fail "Service '$svc' missing"
    fi
  done

  # Check healthchecks for core services
  # Simple check: count healthcheck occurrences
  HC_COUNT=$(grep -c "healthcheck:" "$COMPOSE" || true)
  if [ "$HC_COUNT" -ge 5 ]; then
    pass "Healthchecks found for $HC_COUNT services"
  else
    fail "Expected at least 5 healthchecks, found $HC_COUNT"
  fi

  # Check resource limits
  LIMITS_COUNT=$(grep -c "limits:" "$COMPOSE" || true)
  if [ "$LIMITS_COUNT" -ge 6 ]; then
    pass "Resource limits found for $LIMITS_COUNT services"
  else
    fail "Expected at least 6 resource limit blocks, found $LIMITS_COUNT"
  fi

  # Check volumes section
  if grep -q "^volumes:" "$COMPOSE"; then
    pass "Volumes section defined"
  else
    fail "Volumes section missing"
  fi

  # Check all ports are unique
  PORTS=$(grep -oP '"\d+:\d+"' "$COMPOSE" | sort)
  HOST_PORTS=$(echo "$PORTS" | grep -oP '^\"\K\d+' | sort)
  UNIQUE_HOST_PORTS=$(echo "$HOST_PORTS" | sort -u)
  if [ "$(echo "$HOST_PORTS" | wc -l)" = "$(echo "$UNIQUE_HOST_PORTS" | wc -l)" ]; then
    pass "All host ports are unique"
  else
    fail "Duplicate host ports detected"
  fi

  # Check restart policies
  RESTART_COUNT=$(grep -c "restart:" "$COMPOSE" || true)
  if [ "$RESTART_COUNT" -ge 6 ]; then
    pass "Restart policies found for $RESTART_COUNT services"
  else
    fail "Expected at least 6 restart policies, found $RESTART_COUNT"
  fi

else
  fail "docker-compose.yml not found"
fi

echo ""

# 3. Check .dockerignore
echo "[.dockerignore]"
if [ -f "$PROJECT_DIR/.dockerignore" ]; then
  pass ".dockerignore exists"
  if grep -q "node_modules" "$PROJECT_DIR/.dockerignore"; then
    pass "node_modules excluded"
  else
    fail "node_modules not excluded"
  fi
else
  fail ".dockerignore not found"
fi

echo ""

# 4. Check .env.example
echo "[.env.example]"
if [ -f "$PROJECT_DIR/.env.example" ]; then
  pass ".env.example exists"
  for var in DATABASE_URL REDIS_HOST JWT_ACCESS_SECRET MINIO_ENDPOINT MEILISEARCH_HOST QGIS_SERVER_URL; do
    if grep -q "^${var}=" "$PROJECT_DIR/.env.example"; then
      pass "Env var $var defined"
    else
      fail "Env var $var missing"
    fi
  done
else
  fail ".env.example not found"
fi

echo ""
echo "=== Results ==="
if [ "$ERRORS" -eq 0 ]; then
  echo "All checks passed!"
  exit 0
else
  echo "$ERRORS check(s) failed"
  exit 1
fi
