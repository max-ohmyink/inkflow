import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import { createServer } from "http";
import { createCorsMiddleware } from "./cors";
import { registerStencilRoutes } from "../stencils/routes";
import { startStencilWorker } from "../stencils/service";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(createCorsMiddleware());

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStencilRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // The Docker production build may include an Expo web export. Keep APIs ahead of the SPA
  // fallback so a mistyped API URL is a JSON 404 rather than an application HTML document.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  const uploadsDir = path.resolve(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadsDir));
  // Missing artwork must be a real 404, not the SPA's index.html served as an image.
  app.use("/uploads", (_req, res) => {
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

startServer().catch((error: unknown) => {
  // Name/code only: enough to diagnose without printing stack traces or connection strings.
  const detail = error as {
    name?: string;
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };
  console.error(
    `[api] server failed to start (${detail?.code ?? detail?.name ?? "unknown_error"})`,
  );
  // Redact connection strings; keep the reason so deploy failures are diagnosable.
  const redact = (text?: string) =>
    (text ?? "").replace(/\w+:\/\/\S+/g, "<url>").slice(0, 600);
  console.error(`[api] reason: ${redact(detail?.message)}`);
  if (detail?.cause)
    console.error(
      `[api] cause: ${detail.cause.code ?? ""} ${redact(detail.cause.message)}`,
    );
  process.exit(1);
});
