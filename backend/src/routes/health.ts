import { Hono } from "hono";
import { isDatabaseHealthy } from "../db";
import type { HealthResponse } from "../types/api";

const startTime = Date.now();

const health = new Hono();

health.get("/health", (c) => {
  const dbHealthy = isDatabaseHealthy();

  const response: HealthResponse = {
    status: dbHealthy ? "ok" : "degraded",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: "1.0.0",
    database: dbHealthy ? "connected" : "error",
    timestamp: new Date().toISOString(),
  };

  const statusCode = dbHealthy ? 200 : 503;
  return c.json(response, statusCode);
});

export default health;
