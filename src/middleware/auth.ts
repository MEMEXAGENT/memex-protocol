import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/connection.js";
import { agents, wallets, authAuditLog } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ENV } from "../config.js";
import { verifySignature, isTimestampValid } from "../utils/crypto.js";
import { rawBodyStore } from "../index.js";

declare module "fastify" {
  interface FastifyRequest {
    agentId: string;
  }
}

const SYSTEM_ACCOUNTS = new Set(["treasury", "ecosystem", "reward_pool"]);

async function logAuthEvent(
  agentId: string | null,
  action: string,
  success: boolean,
  request: FastifyRequest,
  detail?: string,
) {
  try {
    await db.insert(authAuditLog).values({
      id: nanoid(),
      agentId,
      action,
      success,
      ipAddress: request.ip,
      userAgent: (request.headers["user-agent"] as string) ?? null,
      detail: detail ?? null,
    });
  } catch {
    request.log.warn("Failed to write auth audit log");
  }
}

/**
 * Decentralized auth middleware — Ed25519 signature verification.
 *
 * Required headers:
 *   X-Agent-Id:   agent's registered ID
 *   X-Timestamp:  unix timestamp in milliseconds
 *   X-Signature:  hex-encoded Ed25519 signature of: timestamp\nMETHOD\n/path\nsha256(body)
 *
 * The server holds ONLY the agent's public key. No secrets, no passwords, no API keys.
 * Only the holder of the corresponding private key can produce a valid signature.
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const agentId = (request.headers["x-agent-id"] as string)?.trim();
  const timestamp = (request.headers["x-timestamp"] as string)?.trim();
  const signature = (request.headers["x-signature"] as string)?.trim();

  // ── Legacy auth fallback (Bearer token) ──
  if (!agentId && !signature) {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return handleLegacyAuth(authHeader.slice(7).trim(), request, reply);
    }
  }

  if (!agentId || !timestamp || !signature) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing auth headers. Required: X-Agent-Id, X-Timestamp, X-Signature",
      },
    });
  }

  if (SYSTEM_ACCOUNTS.has(agentId)) {
    await logAuthEvent(agentId, "system_impersonation_attempt", false, request);
    return reply.status(403).send({
      error: { code: "FORBIDDEN", message: "Cannot authenticate as system account" },
    });
  }

  if (!isTimestampValid(timestamp, ENV.AUTH_TIMESTAMP_WINDOW_MS)) {
    await logAuthEvent(agentId, "signature_expired", false, request);
    return reply.status(401).send({
      error: {
        code: "SIGNATURE_EXPIRED",
        message: `Timestamp outside allowed window (±${ENV.AUTH_TIMESTAMP_WINDOW_MS / 1000}s)`,
      },
    });
  }

  const rows = await db.select().from(agents).where(eq(agents.agentId, agentId)).limit(1);
  const agent = rows[0] ?? null;

  if (!agent) {
    await logAuthEvent(agentId, "unknown_agent", false, request);
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "Agent not registered. Claim tokens first via POST /api/v0/faucet/claim",
      },
    });
  }

  if (!agent.isActive) {
    await logAuthEvent(agentId, "disabled_agent", false, request);
    return reply.status(403).send({
      error: { code: "ACCOUNT_DISABLED", message: "Agent account is disabled" },
    });
  }

  if (!agent.publicKey) {
    await logAuthEvent(agentId, "no_public_key", false, request);
    return reply.status(401).send({
      error: {
        code: "NO_PUBLIC_KEY",
        message: "Agent has no public key registered. Use POST /api/v0/auth/register-key",
      },
    });
  }

    const rawBody = rawBodyStore.get(request.raw) ?? null;

  const valid = verifySignature(
    agent.publicKey,
    timestamp,
    request.method,
    request.url.split("?")[0],
    rawBody,
    signature,
  );

  if (!valid) {
    await logAuthEvent(agentId, "invalid_signature", false, request);
    return reply.status(401).send({
      error: { code: "INVALID_SIGNATURE", message: "Ed25519 signature verification failed" },
    });
  }

  await db
    .update(agents)
    .set({ lastAuthAt: new Date() })
    .where(eq(agents.agentId, agentId));

  await logAuthEvent(agentId, "signature_auth_success", true, request);
  request.agentId = agentId;
}

/**
 * Legacy Bearer-token auth (agent_id only).
 * Kept for backward compatibility during migration. Will be removed.
 */
async function handleLegacyAuth(token: string, request: FastifyRequest, reply: FastifyReply) {
  if (ENV.AUTH_REQUIRE_SIGNATURE) {
    await logAuthEvent(token, "legacy_auth_rejected", false, request);
    return reply.status(401).send({
      error: {
        code: "SIGNATURE_REQUIRED",
        message:
          "Ed25519 signature auth is now required. " +
          "Send X-Agent-Id, X-Timestamp, X-Signature headers. " +
          "See GET /docs for details.",
      },
    });
  }

  const agentId = token;
  if (!agentId) {
    return reply.status(401).send({
      error: { code: "UNAUTHORIZED", message: "Empty Bearer token" },
    });
  }

  if (SYSTEM_ACCOUNTS.has(agentId)) {
    await logAuthEvent(agentId, "system_impersonation_attempt", false, request);
    return reply.status(403).send({
      error: { code: "FORBIDDEN", message: "Cannot authenticate as system account" },
    });
  }

  const rows = await db.select().from(agents).where(eq(agents.agentId, agentId)).limit(1);
  if (rows.length === 0) {
    await db.insert(agents).values({ agentId }).onConflictDoNothing();
    await db.insert(wallets).values({ agentId, balance: "0", staked: "0", available: "0" }).onConflictDoNothing();
  }

  if (rows[0]?.publicKey) {
    await logAuthEvent(agentId, "legacy_auth_has_pubkey_rejected", false, request);
    return reply.status(401).send({
      error: {
        code: "SIGNATURE_REQUIRED",
        message:
          "This agent has a registered public key. " +
          "Use Ed25519 signature auth: X-Agent-Id, X-Timestamp, X-Signature",
      },
    });
  }

  await logAuthEvent(agentId, "legacy_auth_deprecated", true, request, "DEPRECATED");
  reply.header("X-Auth-Deprecation", "Legacy Bearer auth will be removed. Register an Ed25519 public key via POST /api/v0/auth/register-key");
  request.agentId = agentId;
}
