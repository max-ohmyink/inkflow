import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createCorsMiddleware } from "./cors";
import { clearLegacySessionCookie } from "./cookies";
import { registerStencilRoutes } from "../stencils/routes";
import { startStencilWorker } from "../stencils/service";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(createCorsMiddleware());
  app.use(clearLegacySessionCookie());

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerStencilRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // The Docker production build may include an Expo web export. Keep APIs ahead of the SPA
  // fallback so a mistyped API URL is a JSON 404 rather than an application HTML document.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  const webBuild = path.resolve(process.cwd(), "web-build");
  if (existsSync(webBuild)) {
    app.use(express.static(webBuild));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(webBuild, "index.html"));
    });
  }

  // Single-worker recovery must finish before new requests can create current-process jobs.
  await startStencilWorker();
  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, () => {
    console.log("[api] server listening");
  });
}

startServer().catch(() => {
  console.error("[api] server failed to start");
});
