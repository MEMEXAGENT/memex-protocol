import type { FastifyInstance } from "fastify";
import { db } from "../db/connection.js";
import { peers } from "../db/schema.js";

export async function peerRoutes(app: FastifyInstance) {
  app.get("/peers", async () => {
    const rows = await db.select().from(peers);
    return {
      peers: rows.map((p) => ({
        node_id: p.nodeId,
        addr: p.addr,
        rep: Number(p.rep),
        st: p.status,
      })),
    };
  });
}
