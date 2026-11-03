#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres and runs supabase/tests/*.test.sql.
#
#   npm run test:db                       # spins up a temporary local cluster
#   DATABASE_URL=postgres://... npm run test:db   # uses an existing server (CI);
#                                         # a fresh database is created and dropped
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="alh_test_$$"

run_psql() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

cleanup() {
  if [[ -n "${ADMIN_URL:-}" ]]; then
    run_psql "$ADMIN_URL" -c "drop database if exists $DB_NAME" >/dev/null 2>&1 || true
  fi
  if [[ -n "${PGTMP:-}" ]]; then
    $AS_PG "$PGBIN/pg_ctl" -D "$PGTMP/data" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$PGTMP"
  fi
}
trap cleanup EXIT

if [[ -n "${DATABASE_URL:-}" ]]; then
  ADMIN_URL="$DATABASE_URL"
  BASE="${DATABASE_URL%/*}"
else
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  [[ -x "${PGBIN:-}/initdb" ]] || PGBIN="$(dirname "$(command -v initdb)")"
  AS_PG=""
  if [[ "$(id -u)" == "0" ]]; then AS_PG="runuser -u postgres --"; fi
  PGTMP="$(mktemp -d)"; chmod 777 "$PGTMP"
  PORT=$((20000 + RANDOM % 20000))
  $AS_PG "$PGBIN/initdb" -D "$PGTMP/data" -U postgres -A trust >/dev/null
  $AS_PG "$PGBIN/pg_ctl" -D "$PGTMP/data" -o "-p $PORT -k $PGTMP -c listen_addresses=''" -l "$PGTMP/log" -w start >/dev/null
  ADMIN_URL="postgresql://postgres@/postgres?host=$PGTMP&port=$PORT"
  BASE=""
fi

run_psql "$ADMIN_URL" -c "create database $DB_NAME" >/dev/null
if [[ -n "$BASE" ]]; then DB_URL="$BASE/$DB_NAME"; else DB_URL="postgresql://postgres@/$DB_NAME?host=$PGTMP&port=$PORT"; fi

run_psql "$DB_URL" -f "$ROOT/supabase/tests/_supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  run_psql "$DB_URL" -f "$f" >/dev/null
done
if [[ -f "$ROOT/supabase/seed.sql" ]]; then
  echo "seed     seed.sql"
  run_psql "$DB_URL" -f "$ROOT/supabase/seed.sql" >/dev/null
fi

fail=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  # Each test file runs inside a transaction that is rolled back.
  if out=$( { echo "begin;"; cat "$t"; echo "rollback;"; } | run_psql "$DB_URL" 2>&1 ); then
    echo "PASS     $(basename "$t")"
  else
    echo "FAIL     $(basename "$t")"; echo "$out" | sed 's/^/         /'; fail=1
  fi
done
exit $fail
