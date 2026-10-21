#!/usr/bin/env bash
# Starts two instances of the container image behind nginx on a fresh
# database and checks that both migrate, both serve, and each migration is
# recorded once (ADR 0036, decision 14; PH-37 spec, decision 10). Locally:
# pnpm check:scale, which builds the image first. CI passes --no-build to use
# the image its build step loaded.
set -euo pipefail
cd "$(dirname "$0")/.."

build=true
if [[ "${1:-}" == --no-build ]]; then build=false; fi

# The commit the image is built from, as in check-image.sh.
GIT_COMMIT="${GIT_COMMIT:-$(git rev-parse HEAD)}"
export GIT_COMMIT

compose=(docker compose --profile scale)
database=szop_scale

psql() {
  docker compose exec -T postgres psql -U szop -d "$1" -v ON_ERROR_STOP=1 -qtA -c "$2"
}

# Always remove the profile's containers and its database; PostgreSQL keeps
# running.
cleanup() {
  "${compose[@]}" rm --stop --force app-a app-b nginx > /dev/null 2>&1 || true
  psql postgres "DROP DATABASE IF EXISTS $database WITH (FORCE)" > /dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "FAIL: $1" >&2
  local service
  for service in app-a app-b nginx; do
    echo "--- $service's logs ---" >&2
    "${compose[@]}" logs --no-color "$service" >&2 || true
  done
  exit 1
}

if $build; then
  echo "==> Building the image"
  docker compose --profile app build app || fail "the image did not build"
fi

# The two instances must start on an empty database, so they migrate at the
# same time and one waits for the other's lock.
echo "==> Creating a fresh database, $database"
docker compose up --wait postgres > /dev/null || fail "PostgreSQL did not become healthy"
psql postgres "DROP DATABASE IF EXISTS $database WITH (FORCE)" || fail "cannot drop $database"
psql postgres "CREATE DATABASE $database" || fail "cannot create $database"

# --wait returns once both apps answer /api/health, which they do only after
# their migrations ran, and nginx is up.
echo "==> Starting app-a and app-b behind nginx"
"${compose[@]}" up --no-build --wait app-a app-b nginx || fail "the scale profile did not become healthy"

# nginx sends each request to the next instance, so 10 answers name both.
echo "==> Checking that requests reach both instances"
instances=()
for _ in $(seq 10); do
  response=$(curl --silent --max-time 10 --write-out '\n%{http_code}' http://127.0.0.1:8081/api/health) || true
  status=${response##*$'\n'}
  body=${response%$'\n'*}
  [[ "$status" == 200 ]] || fail "GET /api/health through nginx answered '$status', not 200"
  [[ $body =~ \"instance\":\"([0-9a-f]{8})\" ]] || fail "/api/health answered '$body', which names no instance"
  instances+=("${BASH_REMATCH[1]}")
done
distinct=$(printf '%s\n' "${instances[@]}" | sort -u)
count=$(wc -l <<< "$distinct")
[[ "$count" == 2 ]] || fail "nginx reached $count instance(s), not 2: $(tr '\n' ' ' <<< "$distinct")"

echo "==> Checking that each migration is recorded once"
read -r rows times < <(psql "$database" "SELECT count(*), count(DISTINCT created_at) FROM drizzle.__drizzle_migrations" | tr '|' ' ') ||
  fail "cannot read the migrations of $database"
[[ "$rows" == "$times" ]] || fail "a migration was recorded twice ($rows rows for $times migrations)"

echo "OK: two instances ($(tr '\n' ' ' <<< "$distinct" | xargs | sed 's/ /, /')) behind nginx, each migration recorded once"
