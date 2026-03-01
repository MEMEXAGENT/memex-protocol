import type { FastifyInstance } from "fastify";
import { db } from "../db/connection.js";
import { agents, wallets, faucetClaims, transactions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PROTOCOL } from "../config.js";
import { AppError, alreadyClaimed } from "../utils/errors.js";
import { isValidPublicKey } from "../utils/crypto.js";

const RESERVED_AGENT_IDS = new Set([
  "treasury", "ecosystem", "reward_pool", "founder", "admin", "system",
]);

export async function faucetRoutes(app: FastifyInstance) {
  app.post("/faucet/claim", async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;

    const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
    if (!agentId) {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: agent_id");
    }

    if (RESERVED_AGENT_IDS.has(agentId.toLowerCase())) {
      throw new AppError(403, "FORBIDDEN", "This agent_id is reserved");
    }

    const publicKey = typeof body.public_key === "string" ? body.public_key.trim().toLowerCase() : "";
    if (!publicKey) {
      throw new AppError(400, "BAD_REQUEST",
        "Missing required field: public_key (hex-encoded Ed25519 public key, 64 hex chars)");
    }

    if (!isValidPublicKey(publicKey)) {
      throw new AppError(400, "BAD_REQUEST",
        "Invalid public_key. Must be a valid Ed25519 public key encoded as 64 hex characters.");
    }

    const existing = await db.select().from(faucetClaims).where(eq(faucetClaims.agentId, agentId)).limit(1);
    if (existing.length > 0) throw alreadyClaimed("Faucet");

    await db.insert(agents).values({ agentId, publicKey }).onConflictDoNothing();

    const agentRow = await db.select().from(agents).where(eq(agents.agentId, agentId)).limit(1);
    if (agentRow[0] && !agentRow[0].publicKey) {
      await db.update(agents).set({ publicKey }).where(eq(agents.agentId, agentId));
    }

    await db.insert(wallets).values({ agentId, balance: "0", staked: "0", available: "0" }).onConflictDoNothing();

    const amount = PROTOCOL.FAUCET.PER_AGENT_AMOUNT;
    const amountStr = amount.toString();

    await db.insert(faucetClaims).values({ agentId });

    await db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${amountStr}::numeric`,
        available: sql`${wallets.available} + ${amountStr}::numeric`,
      })
      .where(eq(wallets.agentId, agentId));

    await db.insert(transactions).values({
      txId: nanoid(),
      fromAgentId: "ecosystem",
      toAgentId: agentId,
      amount: amountStr,
      txType: "faucet",
    });

    return {
      status: "claimed",
      agent_id: agentId,
      public_key: publicKey,
      amount,
      auth_info: {
        method: "Ed25519 signature",
        headers: {
          "X-Agent-Id": agentId,
          "X-Timestamp": "<unix_ms>",
          "X-Signature": "sign(timestamp + method + path + sha256(body))",
        },
      },
    };
  });
}
