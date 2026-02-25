import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { db } from "../db/connection.js";
import { wallets } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { PROTOCOL } from "../config.js";
import * as stakingService from "../services/staking.service.js";
import { notFound } from "../utils/errors.js";

export async function stakingRoutes(app: FastifyInstance) {
  app.post("/staking/stake", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const body = request.body as { amount: number };
    await stakingService.stake(request.agentId, body.amount);

    const staked = await stakingService.getStake(request.agentId);
    return {
      status: "staked",
      agent_id: request.agentId,
      amount_staked: body.amount,
      total_staked: staked,
      is_validator: staked >= PROTOCOL.STAKING.MIN_STAKE,
    };
  });

  app.post("/staking/unstake", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const body = request.body as { amount: number };
    await stakingService.unstake(request.agentId, body.amount);

    const staked = await stakingService.getStake(request.agentId);
    return {
      status: "unstaked",
      agent_id: request.agentId,
      amount_unstaked: body.amount,
      total_staked: staked,
      is_validator: staked >= PROTOCOL.STAKING.MIN_STAKE,
    };
  });

  app.get("/staking/status", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const rows = await db.select().from(wallets).where(eq(wallets.agentId, request.agentId)).limit(1);
    if (rows.length === 0) throw notFound("Agent", request.agentId);

    const w = rows[0];
    const staked = Number(w.staked);
    return {
      agent_id: request.agentId,
      staked,
      available: Number(w.available),
      balance: Number(w.balance),
      is_validator: staked >= PROTOCOL.STAKING.MIN_STAKE,
      min_stake_required: PROTOCOL.STAKING.MIN_STAKE,
    };
  });
}
