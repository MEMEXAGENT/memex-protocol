import Fastify from "fastify";
import cors from "@fastify/cors";
import { ENV } from "./config.js";
import { AppError } from "./utils/errors.js";
import { vectorRoutes } from "./routes/vectors.js";
import { walletRoutes } from "./routes/wallet.js";
import { taskRoutes } from "./routes/tasks.js";
import { faucetRoutes } from "./routes/faucet.js";
import { missionRoutes } from "./routes/missions.js";
import { governanceRoutes } from "./routes/governance.js";
import { configRoutes } from "./routes/config.js";
import { nodeRoutes } from "./routes/node.js";
import { peerRoutes } from "./routes/peers.js";
import { founderRoutes } from "./routes/founder.js";
import { stakingRoutes } from "./routes/staking.js";
import { docsRoutes } from "./routes/docs.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }

  app.log.error(error);
  return reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: error.message ?? "Internal server error",
    },
  });
});

await app.register(vectorRoutes, { prefix: "/api/v0" });
await app.register(walletRoutes, { prefix: "/api/v0" });
await app.register(taskRoutes, { prefix: "/api/v0" });
await app.register(faucetRoutes, { prefix: "/api/v0" });
await app.register(missionRoutes, { prefix: "/api/v0" });
await app.register(governanceRoutes, { prefix: "/api/v0" });
await app.register(configRoutes, { prefix: "/api/v0" });
await app.register(nodeRoutes, { prefix: "/api/v0" });
await app.register(peerRoutes, { prefix: "/api/v0" });
await app.register(founderRoutes, { prefix: "/api/v0" });
await app.register(stakingRoutes, { prefix: "/api/v0" });
await app.register(docsRoutes);

app.get("/health", async () => ({ status: "ok", version: "0.1.0" }));

try {
  await app.listen({ port: ENV.PORT, host: "0.0.0.0" });
  console.log(`MEMEX v0 node listening on port ${ENV.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
