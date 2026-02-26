import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { feeMiddleware } from "../middleware/fee.js";
import { AppError } from "../utils/errors.js";
import * as vectorService from "../services/vector.service.js";
import { DimensionMismatchError } from "../services/vector.service.js";

const PRIVATE_PREFIX = "private:";

function parseAccess(space: string, agentId: string): { access: "private" | "public" } {
  if (!space.startsWith(PRIVATE_PREFIX)) {
    return { access: "public" };
  }
  const ownerPart = space.slice(PRIVATE_PREFIX.length);
  if (ownerPart !== agentId) {
    throw new AppError(403, "FORBIDDEN",
      `Cannot access private space of another agent. Use "private:${agentId}" for your own space.`);
  }
  return { access: "private" };
}

export async function vectorRoutes(app: FastifyInstance) {
  app.post("/vectors", {
    preHandler: [authMiddleware, feeMiddleware("POST /api/v0/vectors")],
  }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;

    const space = body.space;
    if (typeof space !== "string" || !space.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: space (string)");
    }

    const vector = body.vector;
    if (!Array.isArray(vector) || vector.length === 0 || !vector.every((v) => typeof v === "number")) {
      throw new AppError(400, "BAD_REQUEST",
        "Missing or invalid field: vector (number[]). Example: {\"space\": \"memory\", \"dim\": 3, \"vector\": [0.1, 0.2, 0.3]}");
    }

    const trimmedSpace = space.trim();
    const { access } = parseAccess(trimmedSpace, request.agentId);
    const dim = vector.length;
    const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [];
    const rawMeta = body.meta ?? body.metadata;
    const meta = (typeof rawMeta === "object" && rawMeta !== null ? rawMeta : {}) as Record<string, unknown>;

    try {
      const result = await vectorService.storeVector({
        ownerAgentId: request.agentId,
        space: trimmedSpace,
        dim,
        vector,
        access,
        tags,
        meta,
      });
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof DimensionMismatchError) {
        throw new AppError(400, "DIMENSION_MISMATCH", err.message);
      }
      throw err;
    }
  });

  app.get("/vectors/:vector_id", {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { vector_id } = request.params as { vector_id: string };
    const { include_vector } = request.query as { include_vector?: string };

    const result = await vectorService.getVector(vector_id, include_vector === "true", request.agentId);
    if (result === null) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: `Vector '${vector_id}' not found` } });
    }
    if (result === "FORBIDDEN") {
      return reply.status(403).send({ error: { code: "FORBIDDEN", message: "This vector belongs to a private space of another agent" } });
    }
    return result;
  });

  app.post("/vectors/search", {
    preHandler: [authMiddleware, feeMiddleware("POST /api/v0/vectors/search")],
  }, async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;

    const space = body.space;
    if (typeof space !== "string" || !space.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Missing required field: space (string)");
    }

    const queryVector = body.query_vector;
    if (!Array.isArray(queryVector) || queryVector.length === 0 || !queryVector.every((v) => typeof v === "number")) {
      throw new AppError(400, "BAD_REQUEST",
        "Missing or invalid field: query_vector (number[]). Example: {\"space\": \"memory\", \"query_vector\": [0.1, 0.2, 0.3], \"top_k\": 5}");
    }

    const trimmedSpace = space.trim();
    parseAccess(trimmedSpace, request.agentId);

    const topK = typeof body.top_k === "number" && body.top_k > 0 ? body.top_k : 10;
    const filterTags = Array.isArray(body.filter_tags) ? body.filter_tags.filter((t): t is string => typeof t === "string") : undefined;

    return vectorService.searchVectors({
      space: trimmedSpace,
      queryVector,
      topK,
      requestingAgentId: request.agentId,
      filterTags,
    });
  });
}
