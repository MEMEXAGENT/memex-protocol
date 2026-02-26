import type { FastifyInstance } from "fastify";
import { db } from "../db/connection.js";
import { agents, wallets, faucetClaims, transactions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PROTOCOL } from "../config.js";
import { AppError, alreadyClaimed } from "../utils/errors.js";

function extractAgentId(request: { headers: { authorization?: string }; body: unknown }): string {
  const body = (request.body ?? {}) as Record<string, unknown>;
  if (typeof body.agent_id === "string" && body.agent_id.trim()) {
    return body.agent_id.trim();
  }

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  throw new AppError(400, "BAD_REQUEST", "agent_id is required (in body or Authorization header)");
}

export async function faucetRoutes(app: FastifyInstance) {
  app.post("/faucet/claim", async (request, reply) => {
    const agentId = extractAgentId(request);

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

    return { status: "claimed", agent_id: agentId, amount };
  });
}
