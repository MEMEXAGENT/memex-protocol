import type { FastifyInstance } from "fastify";
import { founderOnly } from "../middleware/founder.js";
import { db } from "../db/connection.js";
import { wallets, transactions, agents } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ENV } from "../config.js";
import { badRequest } from "../utils/errors.js";

export async function founderRoutes(app: FastifyInstance) {
  app.get("/founder/status", {
    preHandler: [founderOnly],
  }, async () => {
    const treasuryWallet = await db.select().from(wallets).where(eq(wallets.agentId, "treasury")).limit(1);
    const founderWallet = await db.select().from(wallets).where(eq(wallets.agentId, ENV.FOUNDER_AGENT_ID)).limit(1);
    const ecosystemWallet = await db.select().from(wallets).where(eq(wallets.agentId, "ecosystem")).limit(1);
    const rewardPoolWallet = await db.select().from(wallets).where(eq(wallets.agentId, "reward_pool")).limit(1);

    return {
      founder: {
        agent_id: ENV.FOUNDER_AGENT_ID,
        balance: founderWallet[0] ? Number(founderWallet[0].balance) : 0,
        staked: founderWallet[0] ? Number(founderWallet[0].staked) : 0,
        available: founderWallet[0] ? Number(founderWallet[0].available) : 0,
      },
      system_wallets: {
        treasury: treasuryWallet[0] ? Number(treasuryWallet[0].balance) : 0,
        ecosystem: ecosystemWallet[0] ? Number(ecosystemWallet[0].balance) : 0,
        reward_pool: rewardPoolWallet[0] ? Number(rewardPoolWallet[0].balance) : 0,
      },
    };
  });

  app.post("/founder/treasury/transfer", {
    preHandler: [founderOnly],
  }, async (request) => {
    const body = request.body as { to_agent_id: string; amount: number; reason: string };
    if (!body.to_agent_id || !body.amount || body.amount <= 0) {
      throw badRequest("to_agent_id and positive amount required");
    }

    const treasury = await db.select().from(wallets).where(eq(wallets.agentId, "treasury")).limit(1);
    const available = Number(treasury[0]?.available ?? 0);
    if (available < body.amount) {
      throw badRequest(`Treasury has ${available} available, requested ${body.amount}`);
    }

    const toExists = await db.select().from(agents).where(eq(agents.agentId, body.to_agent_id)).limit(1);
    if (toExists.length === 0) {
      await db.insert(agents).values({ agentId: body.to_agent_id }).onConflictDoNothing();
      await db.insert(wallets).values({ agentId: body.to_agent_id, balance: "0", staked: "0", available: "0" }).onConflictDoNothing();
    }

    const amountStr = body.amount.toString();

    await db.update(wallets).set({
      balance: sql`${wallets.balance} - ${amountStr}::numeric`,
      available: sql`${wallets.available} - ${amountStr}::numeric`,
    }).where(eq(wallets.agentId, "treasury"));

    await db.update(wallets).set({
      balance: sql`${wallets.balance} + ${amountStr}::numeric`,
      available: sql`${wallets.available} + ${amountStr}::numeric`,
    }).where(eq(wallets.agentId, body.to_agent_id));

    const txId = nanoid();
    await db.insert(transactions).values({
      txId,
      fromAgentId: "treasury",
      toAgentId: body.to_agent_id,
      amount: amountStr,
      txType: `founder_transfer:${body.reason}`,
    });

    return { status: "ok", tx_id: txId, from: "treasury", to: body.to_agent_id, amount: body.amount };
  });
}
