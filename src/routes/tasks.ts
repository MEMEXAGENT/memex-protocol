import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { feeMiddleware } from "../middleware/fee.js";
import * as taskService from "../services/task.service.js";

export async function taskRoutes(app: FastifyInstance) {
  app.post("/tasks", {
    preHandler: [authMiddleware, feeMiddleware("POST /api/v0/tasks")],
  }, async (request, reply) => {
    const body = request.body as {
      code: string;
      inputs: { vectors?: string[]; params?: Record<string, unknown> };
      sandbox_limits?: { time_s: number; mem_mb: number };
    };

    const result = await taskService.submitTask({
      submitterAgentId: request.agentId,
      code: body.code,
      inputs: body.inputs,
      sandboxLimits: body.sandbox_limits,
    });

    return reply.status(202).send(result);
  });

  app.get("/tasks/:task_id", {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { task_id } = request.params as { task_id: string };
    const result = await taskService.getTask(task_id);
    return result;
  });
}
