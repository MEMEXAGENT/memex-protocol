import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";
import * as walletService from "../services/wallet.service.js";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/wallet/balance", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const agentId = (typeof query.agent_id === "string" && query.agent_id.trim())
      ? query.agent_id.trim()
      : request.agentId;

    return walletService.getBalance(agentId);
  });

  app.post("/wallet/transfer", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;

    const toAgentId = body.to_agent_id;
    if (typeof toAgentId !== "string" || !toAgentId.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: to_agent_id");
    }

    const amount = body.amount;
    if (typeof amount !== "number" || amount <= 0) {
      throw new AppError(400, "BAD_REQUEST", "Missing or invalid field: amount (positive number)");
    }

    const fromAgentId = (typeof body.from_agent_id === "string" && body.from_agent_id.trim())
      ? body.from_agent_id.trim()
      : request.agentId;

    return walletService.transfer(fromAgentId, toAgentId.trim(), amount);
  });
}
