import type { FastifyInstance } from "fastify";
import { db } from "../db/connection.js";
import { agents } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { founderOnly } from "../middleware/founder.js";
import { isValidPublicKey } from "../utils/crypto.js";
import { AppError } from "../utils/errors.js";

export async function authRoutes(app: FastifyInstance) {
  /**
   * Rotate public key: authenticated agent registers a new Ed25519 public key.
   * Must sign this request with the CURRENT private key to prove ownership.
   * After rotation, only the new keypair works.
   */
  app.post("/auth/rotate-key", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const newPublicKey = typeof body.new_public_key === "string" ? body.new_public_key.trim().toLowerCase() : "";

    if (!newPublicKey) {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: new_public_key");
    }

    if (!isValidPublicKey(newPublicKey)) {
      throw new AppError(400, "BAD_REQUEST",
        "Invalid new_public_key. Must be a valid Ed25519 public key (64 hex chars).");
    }

    const current = await db.select().from(agents).where(eq(agents.agentId, request.agentId)).limit(1);
    if (current[0]?.publicKey === newPublicKey) {
      throw new AppError(400, "BAD_REQUEST", "New public key is the same as current key");
    }

    await db
      .update(agents)
      .set({ publicKey: newPublicKey })
      .where(eq(agents.agentId, request.agentId));

    return {
      status: "rotated",
      agent_id: request.agentId,
      new_public_key: newPublicKey,
      message: "Public key updated. Use your new private key to sign future requests.",
    };
  });

  /**
   * Register public key for a legacy agent that has no key yet.
   * Only works during grace period (AUTH_REQUIRE_SIGNATURE=false)
   * since legacy auth (Bearer token) is needed to authenticate.
   */
  app.post("/auth/register-key", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const publicKey = typeof body.public_key === "string" ? body.public_key.trim().toLowerCase() : "";

    if (!publicKey) {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: public_key");
    }

    if (!isValidPublicKey(publicKey)) {
      throw new AppError(400, "BAD_REQUEST",
        "Invalid public_key. Must be a valid Ed25519 public key (64 hex chars).");
    }

    const current = await db.select().from(agents).where(eq(agents.agentId, request.agentId)).limit(1);
    if (current[0]?.publicKey) {
      throw new AppError(409, "CONFLICT",
        "Agent already has a public key. Use POST /api/v0/auth/rotate-key to change it.");
    }

    await db
      .update(agents)
      .set({ publicKey })
      .where(eq(agents.agentId, request.agentId));

    return {
      status: "registered",
      agent_id: request.agentId,
      public_key: publicKey,
      message: "Public key registered. Use Ed25519 signature auth from now on.",
    };
  });

  /**
   * Founder-only: force set public key for any agent.
   */
  app.post("/auth/admin/set-key", {
    preHandler: [founderOnly],
  }, async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const targetAgentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
    const publicKey = typeof body.public_key === "string" ? body.public_key.trim().toLowerCase() : "";

    if (!targetAgentId) {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: agent_id");
    }
    if (!publicKey) {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: public_key");
    }
    if (!isValidPublicKey(publicKey)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid public_key");
    }

    const rows = await db.select().from(agents).where(eq(agents.agentId, targetAgentId)).limit(1);
    if (rows.length === 0) {
      throw new AppError(404, "NOT_FOUND", `Agent '${targetAgentId}' not found`);
    }

    await db
      .update(agents)
      .set({ publicKey })
      .where(eq(agents.agentId, targetAgentId));

    return {
      status: "updated",
      agent_id: targetAgentId,
      public_key: publicKey,
    };
  });

  /**
   * Founder-only: disable/enable an agent account.
   */
  app.post("/auth/admin/set-active", {
    preHandler: [founderOnly],
  }, async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const targetAgentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
    const isActive = body.is_active;

    if (!targetAgentId) {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: agent_id");
    }
    if (typeof isActive !== "boolean") {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: is_active (boolean)");
    }

    const rows = await db.select().from(agents).where(eq(agents.agentId, targetAgentId)).limit(1);
    if (rows.length === 0) {
      throw new AppError(404, "NOT_FOUND", `Agent '${targetAgentId}' not found`);
    }

    await db
      .update(agents)
      .set({ isActive })
      .where(eq(agents.agentId, targetAgentId));

    return { status: "updated", agent_id: targetAgentId, is_active: isActive };
  });
}
