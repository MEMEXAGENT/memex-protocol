#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL..."
npx tsx src/db/wait.ts
echo "✅ PostgreSQL ready"

echo "📦 Running migrations..."
npx tsx src/db/migrate.ts

echo "🌱 Running seed..."
npx tsx src/db/seed.ts

echo "🚀 Starting MEMEX v0 node..."
exec npx tsx src/index.ts
