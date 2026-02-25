import { db } from "../db/connection.js";
import { wallets } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { AppError, insufficientBalance, notFound } from "../utils/errors.js";

export async function stake(agentId: string, amount: number) {
  if (amount <= 0) throw new AppError(400, "BAD_REQUEST", "Amount must be positive");

  const rows = await db.select().from(wallets).where(eq(wallets.agentId, agentId)).limit(1);
  if (rows.length === 0) throw notFound("Agent", agentId);

  const available = Number(rows[0].available);
  if (available < amount) throw insufficientBalance(amount, available);

  const amountStr = amount.toString();
  await db
    .update(wallets)
    .set({
      staked: sql`${wallets.staked} + ${amountStr}::numeric`,
      available: sql`${wallets.available} - ${amountStr}::numeric`,
    })
    .where(eq(wallets.agentId, agentId));
}

export async function unstake(agentId: string, amount: number) {
  if (amount <= 0) throw new AppError(400, "BAD_REQUEST", "Amount must be positive");

  const rows = await db.select().from(wallets).where(eq(wallets.agentId, agentId)).limit(1);
  if (rows.length === 0) throw notFound("Agent", agentId);

  const staked = Number(rows[0].staked);
  if (staked < amount) {
    throw new AppError(400, "INSUFFICIENT_STAKE", "Not enough staked MEMEX", {
      requested: amount,
      staked,
    });
  }

  const amountStr = amount.toString();
  await db
    .update(wallets)
    .set({
      staked: sql`${wallets.staked} - ${amountStr}::numeric`,
      available: sql`${wallets.available} + ${amountStr}::numeric`,
    })
    .where(eq(wallets.agentId, agentId));
}

export async function getStake(agentId: string): Promise<number> {
  const rows = await db.select().from(wallets).where(eq(wallets.agentId, agentId)).limit(1);
  if (rows.length === 0) return 0;
  return Number(rows[0].staked);
}
