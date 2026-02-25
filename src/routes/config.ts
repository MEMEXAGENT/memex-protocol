import type { FastifyInstance } from "fastify";
import { getCurrentConfig } from "../services/governance.service.js";

export async function configRoutes(app: FastifyInstance) {
  app.get("/config", async () => {
    return getCurrentConfig();
  });
}
