import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { feeMiddleware } from "../middleware/fee.js";
import * as vectorService from "../services/vector.service.js";

export async function vectorRoutes(app: FastifyInstance) {
  app.post("/vectors", {
    preHandler: [authMiddleware, feeMiddleware("POST /api/v0/vectors")],
  }, async (request, reply) => {
    const body = request.body as {
      space: string;
      dim: number;
      vector: number[];
      tags?: string[];
      meta?: { origin_hash?: string; ttl_s?: number };
    };

    const result = await vectorService.storeVector({
      ownerAgentId: request.agentId,
      space: body.space,
      dim: body.dim,
      vector: body.vector,
      tags: body.tags,
      meta: body.meta,
    });

    return reply.status(201).send(result);
  });

  app.get("/vectors/:vector_id", {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { vector_id } = request.params as { vector_id: string };
    const { include_vector } = request.query as { include_vector?: string };

    const result = await vectorService.getVector(vector_id, include_vector === "true");
    if (!result) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: `Vector '${vector_id}' not found` } });
    }
    return result;
  });

  app.post("/vectors/search", {
    preHandler: [authMiddleware, feeMiddleware("POST /api/v0/vectors/search")],
  }, async (request) => {
    const body = request.body as {
      space: string;
      query_vector: number[];
      top_k: number;
      filter_tags?: string[];
    };

    return vectorService.searchVectors({
      space: body.space,
      queryVector: body.query_vector,
      topK: body.top_k,
      filterTags: body.filter_tags,
    });
  });
}
