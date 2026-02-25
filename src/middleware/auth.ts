import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/connection.js";
import { agents, wallets } from "../db/schema.js";
import { eq } from "drizzle-orm";

declare module "fastify" {
  interface FastifyRequest {
    agentId: string;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" },
    });
  }

  const agentId = authHeader.slice(7).trim();
  if (!agentId) {
    return reply.status(401).send({
      error: { code: "UNAUTHORIZED", message: "Empty agent_id in Bearer token" },
    });
  }

  const existing = await db.select().from(agents).where(eq(agents.agentId, agentId)).limit(1);
  if (existing.length === 0) {
    await db.insert(agents).values({ agentId }).onConflictDoNothing();
    await db.insert(wallets).values({ agentId, balance: "0", staked: "0", available: "0" }).onConflictDoNothing();
  }

  request.agentId = agentId;
}
