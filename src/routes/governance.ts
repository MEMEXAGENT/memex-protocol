import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import * as govService from "../services/governance.service.js";

export async function governanceRoutes(app: FastifyInstance) {
  app.post("/governance/proposals", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const body = request.body as {
      proposer_id: string;
      changes: Array<{ key: string; new_value: number }>;
      activation_epoch?: number;
    };
    return govService.createProposal({
      proposerId: body.proposer_id,
      changes: body.changes,
      activationEpoch: body.activation_epoch,
    });
  });

  app.get("/governance/proposals", {
    preHandler: [authMiddleware],
  }, async () => {
    const list = await govService.listProposals();
    return { proposals: list };
  });

  app.post("/governance/proposals/:proposal_id/vote", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const { proposal_id } = request.params as { proposal_id: string };
    const body = request.body as { voter_id: string; vote: "yes" | "no" };
    return govService.vote(proposal_id, body.voter_id, body.vote);
  });
}
