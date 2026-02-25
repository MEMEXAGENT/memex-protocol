import { db } from "../db/connection.js";
import { wallets, transactions, agents } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { AppError, insufficientBalance, notFound } from "../utils/errors.js";

export async function getBalance(agentId: string) {
  const rows = await db.select().from(wallets).where(eq(wallets.agentId, agentId)).limit(1);
  if (rows.length === 0) throw notFound("Agent", agentId);

  const w = rows[0];
  return {
    agent_id: w.agentId,
    balance: Number(w.balance),
    staked: Number(w.staked),
    available: Number(w.available),
  };
}

export async function transfer(fromAgentId: string, toAgentId: string, amount: number) {
  if (amount <= 0) throw new AppError(400, "BAD_REQUEST", "Amount must be positive");

  const fromWallet = await db.select().from(wallets).where(eq(wallets.agentId, fromAgentId)).limit(1);
  if (fromWallet.length === 0) throw notFound("Agent", fromAgentId);

  const available = Number(fromWallet[0].available);
  if (available < amount) throw insufficientBalance(amount, available);

  const toExists = await db.select().from(agents).where(eq(agents.agentId, toAgentId)).limit(1);
  if (toExists.length === 0) {
    await db.insert(agents).values({ agentId: toAgentId }).onConflictDoNothing();
    await db.insert(wallets).values({ agentId: toAgentId, balance: "0", staked: "0", available: "0" }).onConflictDoNothing();
  }

  const amountStr = amount.toString();

  await db
    .update(wallets)
    .set({
      balance: sql`${wallets.balance} - ${amountStr}::numeric`,
      available: sql`${wallets.available} - ${amountStr}::numeric`,
    })
    .where(eq(wallets.agentId, fromAgentId));

  await db
    .update(wallets)
    .set({
      balance: sql`${wallets.balance} + ${amountStr}::numeric`,
      available: sql`${wallets.available} + ${amountStr}::numeric`,
    })
    .where(eq(wallets.agentId, toAgentId));

  const txId = nanoid();
  await db.insert(transactions).values({
    txId,
    fromAgentId,
    toAgentId,
    amount: amountStr,
    txType: "transfer",
  });

  return { status: "ok", tx_id: txId };
}
