#!/usr/bin/env bash
# One command for a throwaway local test database (run from bundle/: `npm run db:test`).
# Starts the machine's Postgres, (re)creates database "bundle_test" owned by user
# "bundle" (password "bundle"), and applies every SQL file in migrations/.
# Test URL afterwards: postgres://bundle:bundle@127.0.0.1:5432/bundle_test
# Never touches Neon. Made-up data only.
set -euo pipefail

DB_NAME="${TEST_DB_NAME:-bundle_test}"
DB_USER="${TEST_DB_USER:-bundle}"
DB_PASS="${TEST_DB_PASS:-bundle}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

as_postgres() {
  if [ "$(id -un)" = "postgres" ]; then "$@"; elif command -v sudo >/dev/null 2>&1; then sudo -u postgres "$@"; else su postgres -s /bin/sh -c "$(printf '%q ' "$@")"; fi
}

if command -v service >/dev/null 2>&1; then service postgresql start >/dev/null; fi
for _ in $(seq 1 20); do pg_isready -h 127.0.0.1 -q && break; sleep 0.5; done
pg_isready -h 127.0.0.1 -q || { echo "Postgres did not start on 127.0.0.1:5432" >&2; exit 1; }

as_postgres psql -v ON_ERROR_STOP=1 -q -d postgres <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
SQL

URL="postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
for f in "$HERE"/migrations/*.sql; do
  # drizzle-kit separates statements with this marker; psql runs them as plain SQL.
  sed 's/--> statement-breakpoint//' "$f" | psql "$URL" -v ON_ERROR_STOP=1 -q
done
echo "Local test database ready: $URL"
