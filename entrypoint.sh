#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL..."
until node -e "
  import('postgres').then(m => {
    const sql = m.default(process.env.DATABASE_URL);
    sql\`SELECT 1\`.then(() => { sql.end(); process.exit(0); }).catch(() => process.exit(1));
  });
" 2>/dev/null; do
  sleep 1
done
echo "✅ PostgreSQL ready"

echo "📦 Running migrations..."
npx tsx src/db/migrate.ts

echo "🌱 Running seed..."
npx tsx src/db/seed.ts

echo "🚀 Starting MEMEX v0 node..."
exec npx tsx src/index.ts
