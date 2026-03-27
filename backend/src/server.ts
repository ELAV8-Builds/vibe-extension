import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Config } from "./config";
import { AIService } from "./services/ai";
import health from "./routes/health";
import sessions from "./routes/sessions";
import { createChatRoute } from "./routes/chat";
import snapshots from "./routes/snapshots";
import exportRoute from "./routes/export";

/**
 * Create and configure the Hono application with all middleware and routes.
 */
export function createApp(config: Config): Hono {
  const app = new Hono();

  // ── Middleware ──

  // CORS: Allow Chrome extension origins and localhost for development
  app.use(
    "*",
    cors({
      origin: (origin) => {
        // Allow Chrome extension origins
        if (origin && origin.startsWith("chrome-extension://")) {
          return origin;
        }
        // Allow localhost for development
        if (
          origin &&
          (origin.startsWith("http://localhost") ||
            origin.startsWith("http://127.0.0.1"))
        ) {
          return origin;
        }
        // Allow requests with no origin (e.g., server-to-server, curl)
        return "";
      },
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    })
  );

  // Request logging
  app.use("*", logger());

  // API key authentication middleware — skip for health check and OPTIONS
  app.use("/api/*", async (c, next) => {
    // Skip auth if no VIBE_API_KEY is configured (development mode)
    if (!config.vibeApiKey) {
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token !== config.vibeApiKey) {
      return c.json({ error: "Invalid API key" }, 403);
    }

    await next();
  });

  // ── Routes ──

  // Health check (no auth required)
  app.route("/", health);

  // Session management
  app.route("/", sessions);

  // Chat (AI conversation)
  const aiService = new AIService(config);
  const chatRoute = createChatRoute(aiService);
  app.route("/", chatRoute);

  // Snapshots
  app.route("/", snapshots);

  // Export
  app.route("/", exportRoute);

  // 404 fallback
  app.notFound((c) => {
    return c.json(
      {
        error: "Not found",
        details: `Route ${c.req.method} ${c.req.path} does not exist`,
      },
      404
    );
  });

  // Global error handler
  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      500
    );
  });

  return app;
}
