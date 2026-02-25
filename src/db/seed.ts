import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { agents, wallets, configVersions, peers, transactions } from "./schema.js";
import { nanoid } from "nanoid";
import { PROTOCOL, ENV } from "../config.js";

async function seed() {
  const client = postgres(ENV.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("Seeding MEMEX v0 genesis allocation...");

  const treasuryAmount = PROTOCOL.MAX_SUPPLY * PROTOCOL.ALLOCATION.TREASURY;
  const ecosystemAmount = PROTOCOL.MAX_SUPPLY * PROTOCOL.ALLOCATION.ECOSYSTEM;
  const rewardPoolAmount = PROTOCOL.MAX_SUPPLY * PROTOCOL.ALLOCATION.REWARD_POOL;

  const genesisAgents = [
    { id: "treasury", balance: treasuryAmount },
    { id: "ecosystem", balance: ecosystemAmount },
    { id: "reward_pool", balance: rewardPoolAmount },
  ];

  for (const ga of genesisAgents) {
    await db.insert(agents).values({ agentId: ga.id }).onConflictDoNothing();
    await db.insert(wallets).values({
      agentId: ga.id,
      balance: ga.balance.toString(),
      staked: "0",
      available: ga.balance.toString(),
    }).onConflictDoNothing();

    console.log(`  ${ga.id}: ${ga.balance.toLocaleString()} MEMEX`);
  }

  await db.insert(transactions).values({
    txId: nanoid(),
    fromAgentId: null,
    toAgentId: "treasury",
    amount: treasuryAmount.toString(),
    txType: "genesis",
  }).onConflictDoNothing();

  await db.insert(transactions).values({
    txId: nanoid(),
    fromAgentId: null,
    toAgentId: "ecosystem",
    amount: ecosystemAmount.toString(),
    txType: "genesis",
  }).onConflictDoNothing();

  await db.insert(transactions).values({
    txId: nanoid(),
    fromAgentId: null,
    toAgentId: "reward_pool",
    amount: rewardPoolAmount.toString(),
    txType: "genesis",
  }).onConflictDoNothing();

  await db.insert(configVersions).values({
    version: 1,
    effectiveEpoch: 0,
    fees: {
      vectors_store: PROTOCOL.FEES.VECTORS_STORE,
      vectors_search: PROTOCOL.FEES.VECTORS_SEARCH,
      tasks: PROTOCOL.FEES.TASKS,
    },
    staking: {
      min_stake: PROTOCOL.STAKING.MIN_STAKE,
    },
  }).onConflictDoNothing();

  await db.insert(peers).values({
    nodeId: ENV.NODE_ID,
    addr: `127.0.0.1:${ENV.PORT}`,
    rep: "1.0",
    status: "active",
  }).onConflictDoNothing();

  console.log("\nGenesis allocation:");
  console.log(`  Treasury:    ${treasuryAmount.toLocaleString()} MEMEX (${PROTOCOL.ALLOCATION.TREASURY * 100}%)`);
  console.log(`  Ecosystem:   ${ecosystemAmount.toLocaleString()} MEMEX (${PROTOCOL.ALLOCATION.ECOSYSTEM * 100}%)`);
  console.log(`  Reward Pool: ${rewardPoolAmount.toLocaleString()} MEMEX (${PROTOCOL.ALLOCATION.REWARD_POOL * 100}%)`);
  console.log(`  Total:       ${PROTOCOL.MAX_SUPPLY.toLocaleString()} MEMEX`);
  console.log("\nSeed complete.");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
