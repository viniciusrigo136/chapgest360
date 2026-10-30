#!/usr/bin/env bash
# Roda a migração e os testes num banco PostgreSQL descartável.
set -euo pipefail
cd "$(dirname "$0")"
DB=lataria_test
psql -q -v ON_ERROR_STOP=1 -c "drop database if exists $DB" -c "create database $DB" postgres
psql -q -v ON_ERROR_STOP=1 -c "drop role if exists anon; drop role if exists authenticated;" $DB 2>/dev/null || true
psql -q -v ON_ERROR_STOP=1 -f 00_supabase_stub.sql $DB
psql -q -v ON_ERROR_STOP=1 -f ../../supabase/migrations/0001_init.sql $DB
psql -q -v ON_ERROR_STOP=1 -f 99_tests.sql $DB
