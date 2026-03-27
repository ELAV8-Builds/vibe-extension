/**
 * Entry point for running the MCP server standalone.
 * Usage: npx tsx src/mcp/index.ts
 *
 * This starts the Vibe MCP server using stdio transport,
 * allowing it to be used as an MCP tool provider by any
 * MCP-compatible client (e.g., Claude Desktop, Cursor, etc.).
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config.js";
import { initDatabase, closeDatabase } from "../db/index.js";
import { createMcpServer } from "./server.js";

async function main(): Promise<void> {
  // Load configuration (needs ANTHROPIC_API_KEY at minimum)
  const config = loadConfig();

  // Initialize the database
  initDatabase(config.databasePath);
  console.error("Vibe MCP server: database initialized");

  // Create the MCP server with all tools and resources
  const mcpServer = createMcpServer();

  // Create stdio transport for communication with MCP clients
  const transport = new StdioServerTransport();

  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.error(`\nVibe MCP server: received ${signal}, shutting down...`);
    await mcpServer.close();
    closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Connect and start listening
  console.error("Vibe MCP server: starting with stdio transport...");
  await mcpServer.connect(transport);
  console.error("Vibe MCP server: connected and ready");
}

main().catch((err) => {
  console.error("Vibe MCP server: fatal error:", err);
  process.exit(1);
});
