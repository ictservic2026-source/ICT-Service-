#!/usr/bin/env bash
# ทดสอบ migration บน Postgres ธรรมดา (ไม่แตะฐานข้อมูลจริง):  bash supabase/tests/run.sh
# ต้องมี psql และสิทธิ์สร้างฐานข้อมูล (ใช้ตัวแปร PG* มาตรฐาน เช่น PGHOST/PGUSER) — ฐาน ict_migration_test จะถูกสร้างใหม่ทุกครั้ง
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db=ict_migration_test
psql -qX -d postgres -c "drop database if exists $db" -c "create database $db" >/dev/null
run() { psql -qX -v ON_ERROR_STOP=1 -d "$db" -f "$1" >/dev/null; }
run "$here/00_supabase_stub.sql"
run "$here/01_legacy_schema.sql"
run "$here/../migrations/001_secure_public_access.sql"
run "$here/../migrations/001_secure_public_access.sql"   # รันซ้ำได้ (idempotent)
run "$here/../migrations/002_track_lookup.sql"
run "$here/../migrations/002_track_lookup.sql"           # รันซ้ำได้
run "$here/../migrations/003_service_asset_id.sql"
run "$here/../migrations/003_service_asset_id.sql"       # รันซ้ำได้
out="$(psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/02_tests.sql" 2>&1)"
echo "$out" | grep -E "WARNING|ERROR" || true
echo "$out" | sed -n '/passed | failed/,/^(/p'
echo "$out" | grep -Eq '^\s+[0-9]+ \|\s+0$' || { echo "SQL tests FAILED"; exit 1; }
echo "SQL tests passed"
