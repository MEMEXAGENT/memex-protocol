import {
  pgTable,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  boolean,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return "vector";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/[[\]]/g, "")
      .split(",")
      .map(Number);
  },
});

// ─── Agents ───

export const agents = pgTable("agents", {
  agentId: text("agent_id").primaryKey(),
  publicKey: text("public_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Wallets ───

export const wallets = pgTable("wallets", {
  agentId: text("agent_id").primaryKey().references(() => agents.agentId),
  balance: numeric("balance", { precision: 20, scale: 6 }).default("0").notNull(),
  staked: numeric("staked", { precision: 20, scale: 6 }).default("0").notNull(),
  available: numeric("available", { precision: 20, scale: 6 }).default("0").notNull(),
});

// ─── Vectors ───

export const vectors = pgTable(
  "vectors",
  {
    vectorId: text("vector_id").primaryKey(),
    ownerAgentId: text("owner_agent_id").references(() => agents.agentId).notNull(),
    space: text("space").notNull(),
    dim: integer("dim").notNull(),
    embedding: vector("embedding"),
    access: text("access").notNull().default("public"),
    tags: jsonb("tags").$type<string[]>().default([]),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_vectors_space").on(table.space),
    index("idx_vectors_owner").on(table.ownerAgentId),
  ],
);

// ─── Tasks ───

export const tasks = pgTable("tasks", {
  taskId: text("task_id").primaryKey(),
  submitterAgentId: text("submitter_agent_id").references(() => agents.agentId).notNull(),
  code: text("code").notNull(),
  inputs: jsonb("inputs").$type<Record<string, unknown>>().default({}),
  sandboxLimits: jsonb("sandbox_limits").$type<{ time_s: number; mem_mb: number }>(),
  status: text("status").notNull().default("pending"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Faucet Claims ───

export const faucetClaims = pgTable("faucet_claims", {
  agentId: text("agent_id").primaryKey().references(() => agents.agentId),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Mission Claims ───

export const missionClaims = pgTable(
  "mission_claims",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").references(() => agents.agentId).notNull(),
    missionId: text("mission_id").notNull(),
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_mission_claims_agent").on(table.agentId),
  ],
);

// ─── Governance Proposals ───

export const proposals = pgTable("proposals", {
  proposalId: text("proposal_id").primaryKey(),
  proposerId: text("proposer_id").references(() => agents.agentId).notNull(),
  changes: jsonb("changes").$type<Array<{ key: string; new_value: number }>>().notNull(),
  status: text("status").notNull().default("active"),
  activationEpoch: integer("activation_epoch"),
  votesYes: numeric("votes_yes", { precision: 20, scale: 6 }).default("0").notNull(),
  votesNo: numeric("votes_no", { precision: 20, scale: 6 }).default("0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Votes ───

export const votes = pgTable(
  "votes",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id").references(() => proposals.proposalId).notNull(),
    voterId: text("voter_id").references(() => agents.agentId).notNull(),
    vote: text("vote").notNull(),
    stakeWeight: numeric("stake_weight", { precision: 20, scale: 6 }).notNull(),
  },
  (table) => [
    index("idx_votes_proposal").on(table.proposalId),
  ],
);

// ─── Transactions ───

export const transactions = pgTable(
  "transactions",
  {
    txId: text("tx_id").primaryKey(),
    fromAgentId: text("from_agent_id"),
    toAgentId: text("to_agent_id"),
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
    txType: text("tx_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_tx_from").on(table.fromAgentId),
    index("idx_tx_to").on(table.toAgentId),
  ],
);

// ─── Config Versions ───

export const configVersions = pgTable("config_versions", {
  version: integer("version").primaryKey(),
  effectiveEpoch: integer("effective_epoch").notNull(),
  fees: jsonb("fees").$type<{
    vectors_store: number;
    vectors_search: number;
    tasks: number;
  }>().notNull(),
  staking: jsonb("staking").$type<{ min_stake: number }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Peers ───

export const peers = pgTable("peers", {
  nodeId: text("node_id").primaryKey(),
  addr: text("addr").notNull(),
  rep: numeric("rep", { precision: 10, scale: 4 }).default("0").notNull(),
  status: text("st").notNull().default("active"),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow().notNull(),
});
