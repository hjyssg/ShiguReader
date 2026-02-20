import Fastify from "fastify";
import { fsRoutes } from "./routes/fs.js";
import { searchRoutes } from "./routes/search.js";
import { config } from "./config.js";

export function buildApp() {
  const app = Fastify({ logger: config.ENVIRONMENT !== "local" });

  app.register(fsRoutes, { prefix: `${config.API_V1_STR}/fs` });
  app.register(searchRoutes, { prefix: `${config.API_V1_STR}/search` });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
