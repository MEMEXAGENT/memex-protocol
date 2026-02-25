import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import * as walletService from "../services/wallet.service.js";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/wallet/balance", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const { agent_id } = request.query as { agent_id: string };
    return walletService.getBalance(agent_id);
  });

  app.post("/wallet/transfer", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const body = request.body as {
      from_agent_id: string;
      to_agent_id: string;
      amount: number;
    };
    return walletService.transfer(body.from_agent_id, body.to_agent_id, body.amount);
  });
}
