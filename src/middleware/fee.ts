import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/connection.js";
import { wallets, transactions } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PROTOCOL } from "../config.js";

const ROUTE_FEES: Record<string, number> = {
  "POST /api/v0/vectors": PROTOCOL.FEES.VECTORS_STORE,
  "POST /api/v0/vectors/search": PROTOCOL.FEES.VECTORS_SEARCH,
  "POST /api/v0/tasks": PROTOCOL.FEES.TASKS,
};

export function feeMiddleware(routeKey: string) {
  const fee = ROUTE_FEES[routeKey];
  if (!fee) return async () => {};

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const agentId = request.agentId;
    if (!agentId) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const wallet = await db.select().from(wallets).where(eq(wallets.agentId, agentId)).limit(1);
    const available = wallet.length > 0 ? Number(wallet[0].available) : 0;

    if (available < fee) {
      return reply.status(402).send({
        error: {
          code: "INSUFFICIENT_BALANCE",
          message: `This operation costs ${fee} MEMEX, you have ${available} available`,
          details: { required: fee, available },
        },
      });
    }

    const feeStr = fee.toString();
    await db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${feeStr}::numeric`,
        available: sql`${wallets.available} - ${feeStr}::numeric`,
      })
      .where(eq(wallets.agentId, agentId));

    await db.insert(transactions).values({
      txId: nanoid(),
      fromAgentId: agentId,
      toAgentId: "treasury",
      amount: feeStr,
      txType: "fee",
    });
  };
}
