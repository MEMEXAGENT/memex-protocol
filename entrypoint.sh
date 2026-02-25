#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRY=0
until npx tsx -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL ?? '');
await sql\`SELECT 1\`;
await sql.end();
console.log('DB connection OK');
" 2>&1; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "❌ PostgreSQL not reachable after ${MAX_RETRIES} attempts"
    exit 1
  fi
  echo "  Retry $RETRY/$MAX_RETRIES..."
  sleep 2
done
echo "✅ PostgreSQL ready"

echo "📦 Running migrations..."
npx tsx src/db/migrate.ts

echo "🌱 Running seed..."
npx tsx src/db/seed.ts

echo "🚀 Starting MEMEX v0 node..."
exec npx tsx src/index.ts
