import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";
import { ENV } from "../config.js";

async function migrate() {
  const client = postgres(ENV.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("Enabling pgvector extension...");
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

  console.log("Creating tables...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agents (
      agent_id TEXT PRIMARY KEY,
      public_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wallets (
      agent_id TEXT PRIMARY KEY REFERENCES agents(agent_id),
      balance NUMERIC(20,6) NOT NULL DEFAULT 0,
      staked NUMERIC(20,6) NOT NULL DEFAULT 0,
      available NUMERIC(20,6) NOT NULL DEFAULT 0
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vectors (
      vector_id TEXT PRIMARY KEY,
      owner_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
      space TEXT NOT NULL,
      dim INTEGER NOT NULL,
      embedding vector,
      tags JSONB DEFAULT '[]',
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_vectors_space ON vectors(space)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_vectors_owner ON vectors(owner_agent_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      submitter_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
      code TEXT NOT NULL,
      inputs JSONB DEFAULT '{}',
      sandbox_limits JSONB,
      status TEXT NOT NULL DEFAULT 'pending',
      result JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS faucet_claims (
      agent_id TEXT PRIMARY KEY REFERENCES agents(agent_id),
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mission_claims (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(agent_id),
      mission_id TEXT NOT NULL,
      amount NUMERIC(20,6) NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_mission_claims_agent ON mission_claims(agent_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS proposals (
      proposal_id TEXT PRIMARY KEY,
      proposer_id TEXT NOT NULL REFERENCES agents(agent_id),
      changes JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      activation_epoch INTEGER,
      votes_yes NUMERIC(20,6) NOT NULL DEFAULT 0,
      votes_no NUMERIC(20,6) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES proposals(proposal_id),
      voter_id TEXT NOT NULL REFERENCES agents(agent_id),
      vote TEXT NOT NULL,
      stake_weight NUMERIC(20,6) NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_votes_proposal ON votes(proposal_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS transactions (
      tx_id TEXT PRIMARY KEY,
      from_agent_id TEXT,
      to_agent_id TEXT,
      amount NUMERIC(20,6) NOT NULL,
      tx_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions(from_agent_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions(to_agent_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS config_versions (
      version INTEGER PRIMARY KEY,
      effective_epoch INTEGER NOT NULL,
      fees JSONB NOT NULL,
      staking JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS peers (
      node_id TEXT PRIMARY KEY,
      addr TEXT NOT NULL,
      rep NUMERIC(10,4) NOT NULL DEFAULT 0,
      st TEXT NOT NULL DEFAULT 'active',
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log("Migration complete.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
