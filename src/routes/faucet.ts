import type { FastifyInstance } from "fastify";
import { db } from "../db/connection.js";
import { agents, wallets, faucetClaims, transactions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PROTOCOL } from "../config.js";
import { alreadyClaimed } from "../utils/errors.js";

export async function faucetRoutes(app: FastifyInstance) {
  app.post("/faucet/claim", async (request, reply) => {
    const body = request.body as { agent_id: string };
    const agentId = body.agent_id;

    await db.insert(agents).values({ agentId }).onConflictDoNothing();
    await db.insert(wallets).values({ agentId, balance: "0", staked: "0", available: "0" }).onConflictDoNothing();

    const existing = await db.select().from(faucetClaims).where(eq(faucetClaims.agentId, agentId)).limit(1);
    if (existing.length > 0) throw alreadyClaimed("Faucet");

    const amount = PROTOCOL.FAUCET.PER_AGENT_AMOUNT;
    const amountStr = amount.toString();

    await db.insert(faucetClaims).values({ agentId });

    await db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${amountStr}::numeric`,
        available: sql`${wallets.available} + ${amountStr}::numeric`,
      })
      .where(eq(wallets.agentId, agentId));

    await db.insert(transactions).values({
      txId: nanoid(),
      fromAgentId: "ecosystem",
      toAgentId: agentId,
      amount: amountStr,
      txType: "faucet",
    });

    return { status: "claimed", amount };
  });
}
