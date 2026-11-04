#!/usr/bin/env bash
# Starts compose.yaml's prodlike profile, a production-like copy with HTTPS,
# TLS to the database and db-setup, on a fresh database with new throwaway
# certificates, and checks what the demo checked until PH-44 (ADR 0064,
# decisions 2 and 7). Run by hand as pnpm check:prodlike, never in CI.
#   --no-build  use the szop:local image as it is
#   --keep      leave the environment up afterwards, on success or failure
#   --down      only remove a kept environment
set -euo pipefail
cd "$(dirname "$0")/.."

build=true
keep=false
for arg in "$@"; do
  case "$arg" in
    --no-build) build=false ;;
    --keep) keep=true ;;
    --down) down_only=true ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

# The commit the image is built from, as in check-image.sh.
GIT_COMMIT="${GIT_COMMIT:-$(git rev-parse HEAD)}"
export GIT_COMMIT

compose=(docker compose --profile prodlike)
services=(postgres-tls db-setup-prodlike app-prodlike nginx-prodlike)
certs=.prodlike/certs
url=https://localhost:8443

# Only the profile's containers, volume and network: `down --volumes` would
# remove the developer's database too.
remove() {
  "${compose[@]}" rm --stop --force --volumes "${services[@]}" > /dev/null 2>&1 || true
  docker volume rm szop_postgres-prodlike-data > /dev/null 2>&1 || true
  docker network rm szop_prodlike > /dev/null 2>&1 || true
}

if [[ "${down_only:-false}" == true ]]; then
  remove
  echo "OK: the prodlike environment is removed"
  exit 0
fi

finish() {
  if $keep; then
    echo "==> Kept: $url (the browser warns about the throwaway certificate once)"
    echo "    Remove it with: pnpm check:prodlike --down"
  else
    remove
  fi
}
trap finish EXIT

fail() {
  echo "FAIL: $1" >&2
  local service
  for service in "${services[@]}"; do
    echo "--- $service's logs ---" >&2
    "${compose[@]}" logs --no-color "$service" >&2 || true
  done
  exit 1
}

psql() {
  "${compose[@]}" exec -T postgres-tls psql -U szop -d szop -v ON_ERROR_STOP=1 -qtA -c "$1"
}

# A previous run, kept or not, so this one starts on a fresh database.
echo "==> Removing a previous run"
remove

# A throwaway certificate authority and the two server certificates it signs,
# each naming its host in the SAN, which verify-full and browsers check. Never
# committed, never installed on the system.
echo "==> Making the certificates in $certs"
rm -rf "$certs"
mkdir -p "$certs"
(
  cd "$certs"
  openssl req -x509 -newkey rsa:2048 -nodes -days 3 -subj "/CN=Szop prodlike CA" \
    -keyout ca.key -out ca.pem 2> /dev/null
  for host in localhost postgres-tls; do
    name=${host%-tls}
    openssl req -newkey rsa:2048 -nodes -subj "/CN=$host" \
      -keyout "$name.key" -out "$name.csr" 2> /dev/null
    openssl x509 -req -days 3 -in "$name.csr" -CA ca.pem -CAkey ca.key -CAcreateserial \
      -extfile <(echo "subjectAltName=DNS:$host") -out "$name.pem" 2> /dev/null
  done
  # Readable by the containers' users; postgres-tls copies its key to 0600.
  chmod 0644 ./*
) || fail "openssl could not make the certificates"

if $build; then
  echo "==> Building the image"
  docker compose --profile app build app || fail "the image did not build"
fi

# --wait returns once nginx answers through to the app, which listens only
# after db-setup ran and the migrations applied.
echo "==> Starting the prodlike profile"
"${compose[@]}" up --no-build --wait nginx-prodlike ||
  fail "the prodlike profile did not become healthy (if Docker says the subnet overlaps, change it in compose.yaml and app-prodlike's TRUSTED_PROXIES together)"

echo "==> Checking HTTPS, the redirect and the security headers"
health=$(curl --silent --show-error --max-time 10 --cacert "$certs/ca.pem" "$url/api/health") ||
  fail "GET $url/api/health failed"
[[ "$health" == *'"status":"ok"'* && "$health" == *"\"commit\":\"$GIT_COMMIT\""* ]] ||
  fail "/api/health answered '$health', not ok with commit $GIT_COMMIT"

# Right after the health check, while its pooled connection is still open.
echo "==> Checking that the app's database connections use TLS"
read -r all_ssl connections < <(psql "SELECT bool_and(s.ssl), count(*) FROM pg_stat_ssl s JOIN pg_stat_activity a USING (pid) WHERE a.usename = 'szop_app'" | tr '|' ' ') ||
  fail "cannot read pg_stat_ssl"
[[ "$all_ssl" == t && "$connections" -gt 0 ]] ||
  fail "the app's connections: ssl '$all_ssl', $connections connection(s); expected all over TLS"
if "${compose[@]}" exec -T -e PGPASSWORD=szop postgres-tls \
  psql "host=127.0.0.1 user=szop dbname=szop sslmode=disable" -c "SELECT 1" > /dev/null 2>&1; then
  fail "postgres-tls accepted a connection without TLS"
fi

redirect=$(curl --silent --max-time 10 --output /dev/null --write-out '%{http_code} %{redirect_url}' "http://localhost:8082/lists?x=1") ||
  fail "GET http://localhost:8082/lists?x=1 failed"
[[ "$redirect" == "301 $url/lists?x=1" ]] ||
  fail "http://localhost:8082/lists?x=1 answered '$redirect', not '301 $url/lists?x=1'"

headers=$(curl --silent --show-error --max-time 10 --cacert "$certs/ca.pem" --dump-header - --output /dev/null "$url/") ||
  fail "GET $url/ failed"
for header in strict-transport-security content-security-policy; do
  grep -qi "^$header:" <<< "$headers" || fail "$url/ has no $header header"
done

echo "==> Running the prodlike Playwright project"
pnpm --filter @szop/e2e exec playwright test -c playwright.prodlike.config.ts ||
  fail "the prodlike Playwright project failed"

echo "OK: the prodlike profile serves commit ${GIT_COMMIT:0:7} over HTTPS, redirects HTTP, sends HSTS and the CSP, reaches PostgreSQL over TLS, sets a __Host- cookie and logs nothing on any screen"
