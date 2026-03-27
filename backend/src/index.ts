import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { initDatabase, closeDatabase } from "./db";
import { createApp } from "./server";

async function main(): Promise<void> {
  // Load and validate configuration
  console.log("Loading configuration...");
  const config = loadConfig();

  // Initialize database
  console.log("Initializing database...");
  initDatabase(config.databasePath);

  // Create the Hono application
  const app = createApp(config);

  // Start the server
  const server = serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    (info) => {
      console.log(`Vibe backend running on http://localhost:${info.port}`);
      console.log(`Health check: http://localhost:${info.port}/health`);
      console.log(
        `API key auth: ${config.vibeApiKey ? "enabled" : "disabled (no VIBE_API_KEY set)"}`
      );
    }
  );

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    closeDatabase();
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });

    // Force exit after 5 seconds if graceful shutdown stalls
    setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 5000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
