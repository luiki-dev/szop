#!/usr/bin/env bash
# Starts the container image next to PostgreSQL and checks that it serves
# (ADR 0028). Locally: pnpm check:image, which builds the image first. CI
# passes --no-build to use the image its build step loaded.
set -euo pipefail
cd "$(dirname "$0")/.."

build=--build
if [[ "${1:-}" == --no-build ]]; then build=--no-build; fi

compose=(docker compose --profile app)

# Always remove the app's container; PostgreSQL keeps running.
cleanup() { "${compose[@]}" rm --stop --force app > /dev/null 2>&1 || true; }
trap cleanup EXIT

fail() {
  echo "FAIL: $1" >&2
  echo "--- the app's logs ---" >&2
  "${compose[@]}" logs --no-color app >&2 || true
  exit 1
}

# --wait returns once the healthcheck passes: /api/health answered 200, which
# the API only does after its migrations ran (OP-078).
echo "==> Starting the image next to PostgreSQL"
"${compose[@]}" up "$build" --wait app || fail "the app did not become healthy"

echo "==> Checking that it does not run as root"
user=$(docker inspect --format '{{.Config.User}}' szop:local) || fail "cannot inspect szop:local"
[[ "$user" == node ]] || fail "the image's user is '$user', not node"
uid=$("${compose[@]}" exec -T app id -u) || fail "cannot run id in the app"
[[ "$uid" != 0 ]] || fail "the app runs as root"

# A wrong WEB_ROOT keeps /api/health at 200 while / answers a plain-text 404
# (OP-084).
echo "==> Checking that / serves the app"
# curl writes 000 when it gets no answer within the time limit.
read -r status type < <(curl --silent --max-time 10 --output /dev/null \
  --write-out '%{http_code} %{content_type}\n' http://127.0.0.1:8080/)
[[ "$status" != 000 ]] || fail "GET / did not answer within 10 seconds"
[[ "$status" == 200 ]] || fail "GET / answered $status, not 200"
[[ "$type" == text/html* ]] || fail "GET / answered '$type', not text/html"

echo "OK: the image starts, migrates, runs as $user (uid $uid) and serves the app"
