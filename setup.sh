#!/usr/bin/env bash
set -euo pipefail

SKIP_DOCKER=false
SKIP_PRISMA=false
SKIP_ENV=false
SKIP_OFFLINE_API=false

usage() {
  cat <<'EOF'
Usage: ./setup.sh [--skip-docker] [--skip-prisma] [--skip-env] [--skip-offline-api]

Options:
  --skip-docker   Skip starting Docker services.
  --skip-prisma   Skip Prisma migrations.
  --skip-env      Skip creating .env files.
  --skip-offline-api  Skip v2 offline API setup.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-docker) SKIP_DOCKER=true ;;
    --skip-prisma) SKIP_PRISMA=true ;;
    --skip-env) SKIP_ENV=true ;;
    --skip-offline-api) SKIP_OFFLINE_API=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

section() {
  echo
  echo "$1"
}

fail() {
  echo "$1" >&2
  exit 1
}

require_cmd() {
  local name="$1"
  local hint="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    fail "Missing $name. $hint"
  fi
}

require_node18() {
  local major
  major="$(node -p "parseInt(process.versions.node.split('.')[0], 10)")"
  if [[ "$major" -lt 18 ]]; then
    fail "Node.js 18+ is required. Found $(node -v)."
  fi
}

ensure_docker_compose() {
  if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose is not available. Update Docker Desktop or install docker-compose."
  fi
}

copy_env_if_missing() {
  local dir="$1"
  local env_path="$dir/.env"
  local example_path="$dir/.env.example"
  if [[ -f "$env_path" ]]; then
    echo "Found $env_path"
    return
  fi
  if [[ -f "$example_path" ]]; then
    cp "$example_path" "$env_path"
    echo "Created $env_path from .env.example"
    return
  fi
  echo "Warning: $example_path not found. Create $env_path manually." >&2
}

install_node_deps() {
  local dir="$1"
  if [[ -f "$dir/package-lock.json" ]]; then
    (cd "$dir" && npm ci)
  else
    (cd "$dir" && npm install)
  fi
}

section "Checking prerequisites..."
require_cmd node "Install Node.js 18+ from nodejs.org."
require_cmd npm "Install Node.js 18+ from nodejs.org."
require_node18

if [[ "$SKIP_DOCKER" == "false" ]]; then
  require_cmd docker "Install Docker from docker.com."
  ensure_docker_compose
fi

if [[ "$SKIP_ENV" == "false" ]]; then
  section "Creating .env files if missing..."
  copy_env_if_missing "$ROOT/services/api"
  copy_env_if_missing "$ROOT/apps/dapp"
  if [[ "$SKIP_OFFLINE_API" == "false" ]]; then
    copy_env_if_missing "$ROOT/v2/services/offline-api"
  fi
fi

if [[ "$SKIP_DOCKER" == "false" ]]; then
  section "Starting infrastructure (Postgres + MinIO)..."
  (cd "$ROOT" && docker compose up -d)
fi

section "Installing dependencies..."
install_node_deps "$ROOT/services/api"
install_node_deps "$ROOT/apps/dapp"
if [[ "$SKIP_OFFLINE_API" == "false" ]]; then
  install_node_deps "$ROOT/v2/services/offline-api"
fi

if [[ "$SKIP_PRISMA" == "false" ]]; then
  section "Running Prisma setup..."
  (cd "$ROOT/services/api" && npx prisma migrate dev --name init)
  (cd "$ROOT/services/api" && npx prisma generate)
  if [[ "$SKIP_OFFLINE_API" == "false" ]]; then
    (cd "$ROOT/v2/services/offline-api" && npm run prisma:generate)
    (cd "$ROOT/v2/services/offline-api" && npm run prisma:push)
  fi
fi

section "Setup complete."
echo "Next steps:"
echo "1) Edit services/api/.env and apps/dapp/.env with real values."
if [[ "$SKIP_OFFLINE_API" == "false" ]]; then
  echo "2) Edit v2/services/offline-api/.env and set OFFLINE_RFID_PEPPER + blockchain values."
  echo "3) Start services with ./start.ps1 on Windows or run npm run dev in each app."
else
  echo "2) Start services with npm run dev in apps/dapp and services/api."
fi
