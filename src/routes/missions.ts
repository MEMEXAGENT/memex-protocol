import type { FastifyInstance } from "fastify";
import { db } from "../db/connection.js";
import { wallets, missionClaims, transactions } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { badRequest } from "../utils/errors.js";
import { authMiddleware } from "../middleware/auth.js";

const AVAILABLE_MISSIONS: Record<string, number> = {
  moltask_share_spec: 2,
  moltask_integrate_memex: 5,
};

export async function missionRoutes(app: FastifyInstance) {
  app.post("/missions/claim", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const body = request.body as {
      agent_id: string;
      mission_id: string;
      proof: Record<string, unknown>;
    };

    const reward = AVAILABLE_MISSIONS[body.mission_id];
    if (reward === undefined) throw badRequest(`Unknown mission: ${body.mission_id}`);

    const claimId = nanoid();
    const amountStr = reward.toString();

    await db.insert(missionClaims).values({
      id: claimId,
      agentId: body.agent_id,
      missionId: body.mission_id,
      amount: amountStr,
    });

    await db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${amountStr}::numeric`,
        available: sql`${wallets.available} + ${amountStr}::numeric`,
      })
      .where(eq(wallets.agentId, body.agent_id));

    await db.insert(transactions).values({
      txId: nanoid(),
      fromAgentId: "ecosystem",
      toAgentId: body.agent_id,
      amount: amountStr,
      txType: "mission_reward",
    });

    return { status: "claimed", mission_id: body.mission_id, amount: reward };
  });
}
