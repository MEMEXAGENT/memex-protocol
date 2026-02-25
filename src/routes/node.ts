import type { FastifyInstance } from "fastify";
import { ENV, PROTOCOL } from "../config.js";
import { db } from "../db/connection.js";
import { peers, wallets } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

const startTime = Date.now();

export async function nodeRoutes(app: FastifyInstance) {
  app.get("/node/status", async () => {
    const peerCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM peers`);
    const cnt = Number((peerCount[0] as Record<string, unknown>).cnt ?? 0);

    return {
      node_id: ENV.NODE_ID,
      role: "validator",
      uptime_s: Math.floor((Date.now() - startTime) / 1000),
      sandbox_limits: {
        time_s: PROTOCOL.SANDBOX.DEFAULT_TIME_S,
        mem_mb: PROTOCOL.SANDBOX.DEFAULT_MEM_MB,
        net: "none",
        fs: "none",
      },
      rep: 1.0,
      stake: 0,
      peers: cnt,
    };
  });
}
