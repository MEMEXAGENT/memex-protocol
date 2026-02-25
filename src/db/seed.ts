import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { agents, wallets, configVersions, peers, transactions } from "./schema.js";
import { nanoid } from "nanoid";
import { PROTOCOL, ENV } from "../config.js";
import { sql } from "drizzle-orm";

async function seed() {
  const client = postgres(ENV.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("═══════════════════════════════════════");
  console.log("  MEMEX v0 — Genesis Block");
  console.log("═══════════════════════════════════════\n");

  // ── 1. System accounts (immutable protocol wallets) ──

  const treasuryAmount = PROTOCOL.MAX_SUPPLY * PROTOCOL.ALLOCATION.TREASURY;
  const ecosystemAmount = PROTOCOL.MAX_SUPPLY * PROTOCOL.ALLOCATION.ECOSYSTEM;
  const rewardPoolAmount = PROTOCOL.MAX_SUPPLY * PROTOCOL.ALLOCATION.REWARD_POOL;

  const systemAccounts = [
    { id: "treasury", balance: treasuryAmount },
    { id: "ecosystem", balance: ecosystemAmount },
    { id: "reward_pool", balance: rewardPoolAmount },
  ];

  console.log("[1/4] Creating system accounts...");
  for (const acct of systemAccounts) {
    await db.insert(agents).values({ agentId: acct.id }).onConflictDoNothing();
    await db.insert(wallets).values({
      agentId: acct.id,
      balance: acct.balance.toString(),
      staked: "0",
      available: acct.balance.toString(),
    }).onConflictDoNothing();
  }

  for (const acct of systemAccounts) {
    await db.insert(transactions).values({
      txId: nanoid(),
      fromAgentId: null,
      toAgentId: acct.id,
      amount: acct.balance.toString(),
      txType: "genesis",
    }).onConflictDoNothing();
  }

  // ── 2. Founder account ──

  const founderId = ENV.FOUNDER_AGENT_ID;
  const founderFund = ENV.FOUNDER_INITIAL_FUND;
  const founderStake = ENV.FOUNDER_INITIAL_STAKE;
  const founderAvailable = founderFund - founderStake;

  console.log(`[2/4] Creating founder account: ${founderId}`);
  console.log(`       Fund: ${founderFund.toLocaleString()} MEMEX (from treasury)`);
  console.log(`       Stake: ${founderStake.toLocaleString()} MEMEX (first validator)`);
  console.log(`       Available: ${founderAvailable.toLocaleString()} MEMEX`);

  await db.insert(agents).values({
    agentId: founderId,
    publicKey: `founder:${founderId}`,
  }).onConflictDoNothing();

  await db.insert(wallets).values({
    agentId: founderId,
    balance: founderFund.toString(),
    staked: founderStake.toString(),
    available: founderAvailable.toString(),
  }).onConflictDoNothing();

  // Deduct founder's fund from treasury
  const founderFundStr = founderFund.toString();
  await db
    .update(wallets)
    .set({
      balance: sql`${wallets.balance} - ${founderFundStr}::numeric`,
      available: sql`${wallets.available} - ${founderFundStr}::numeric`,
    })
    .where(sql`${wallets.agentId} = 'treasury'`);

  await db.insert(transactions).values({
    txId: nanoid(),
    fromAgentId: "treasury",
    toAgentId: founderId,
    amount: founderFundStr,
    txType: "genesis_founder",
  }).onConflictDoNothing();

  // ── 3. Genesis config ──

  console.log("[3/4] Writing genesis config (v1)...");
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

  // ── 4. Bootstrap peer ──

  console.log("[4/4] Registering bootstrap node...");
  await db.insert(peers).values({
    nodeId: ENV.NODE_ID,
    addr: `127.0.0.1:${ENV.PORT}`,
    rep: "1.0",
    status: "active",
  }).onConflictDoNothing();

  // ── Summary ──

  console.log("\n═══════════════════════════════════════");
  console.log("  Genesis Allocation");
  console.log("═══════════════════════════════════════");
  console.log(`  Treasury:     ${(treasuryAmount - founderFund).toLocaleString()} MEMEX (${PROTOCOL.ALLOCATION.TREASURY * 100}% minus founder fund)`);
  console.log(`  Ecosystem:    ${ecosystemAmount.toLocaleString()} MEMEX (${PROTOCOL.ALLOCATION.ECOSYSTEM * 100}%)`);
  console.log(`  Reward Pool:  ${rewardPoolAmount.toLocaleString()} MEMEX (${PROTOCOL.ALLOCATION.REWARD_POOL * 100}%)`);
  console.log(`  ──────────────────────────────`);
  console.log(`  Founder (${founderId}):`);
  console.log(`    Balance:    ${founderFund.toLocaleString()} MEMEX`);
  console.log(`    Staked:     ${founderStake.toLocaleString()} MEMEX (validator)`);
  console.log(`    Available:  ${founderAvailable.toLocaleString()} MEMEX`);
  console.log(`  ──────────────────────────────`);
  console.log(`  Total:        ${PROTOCOL.MAX_SUPPLY.toLocaleString()} MEMEX`);
  console.log("═══════════════════════════════════════\n");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
