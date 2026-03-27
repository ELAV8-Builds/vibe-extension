import dotenv from "dotenv";
import path from "path";

// Load .env file from the backend root
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export interface Config {
  anthropicApiKey: string;
  vibeApiKey: string;
  port: number;
  databasePath: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`FATAL: Required environment variable ${name} is not set.`);
    process.exit(1);
  }
  return value.trim();
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return fallback;
  }
  return value.trim();
}

export function loadConfig(): Config {
  const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");
  const vibeApiKey = optionalEnv("VIBE_API_KEY", "");
  const port = parseInt(optionalEnv("PORT", "5100"), 10);
  const databasePath = optionalEnv(
    "DATABASE_PATH",
    path.resolve(__dirname, "..", "data", "vibe.db")
  );

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error("FATAL: PORT must be a valid port number (1-65535).");
    process.exit(1);
  }

  return {
    anthropicApiKey,
    vibeApiKey,
    port,
    databasePath,
  };
}
