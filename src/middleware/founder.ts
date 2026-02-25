import type { FastifyRequest, FastifyReply } from "fastify";
import { ENV } from "../config.js";

export async function founderOnly(request: FastifyRequest, reply: FastifyReply) {
  const secret = request.headers["x-founder-secret"] as string | undefined;

  if (!ENV.FOUNDER_SECRET) {
    return reply.status(503).send({
      error: { code: "NOT_CONFIGURED", message: "Founder secret not configured" },
    });
  }

  if (secret !== ENV.FOUNDER_SECRET) {
    return reply.status(403).send({
      error: { code: "FORBIDDEN", message: "Invalid founder credentials" },
    });
  }

  request.agentId = ENV.FOUNDER_AGENT_ID;
}
