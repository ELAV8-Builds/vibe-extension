import { Hono } from "hono";
import { generateCSSExport, generateJSONExport } from "../services/export";
import type { ErrorResponse } from "../types/api";

const exportRoute = new Hono();

/**
 * GET /api/export/:sessionId/:format — Export session changes.
 * Supported formats: css, json
 */
exportRoute.get("/api/export/:sessionId/:format", (c) => {
  const { sessionId, format } = c.req.param();

  if (format !== "css" && format !== "json") {
    const err: ErrorResponse = {
      error: "Invalid export format",
      details: 'Supported formats: "css", "json"',
    };
    return c.json(err, 400);
  }

  try {
    if (format === "css") {
      const css = generateCSSExport(sessionId);
      c.header("Content-Type", "text/css; charset=utf-8");
      c.header(
        "Content-Disposition",
        `attachment; filename="vibe-changes-${sessionId.slice(0, 8)}.css"`
      );
      return c.text(css);
    } else {
      const json = generateJSONExport(sessionId);
      c.header("Content-Type", "application/json; charset=utf-8");
      c.header(
        "Content-Disposition",
        `attachment; filename="vibe-changes-${sessionId.slice(0, 8)}.json"`
      );
      return c.text(json);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Export generation failed";

    if (message.includes("not found")) {
      const err: ErrorResponse = { error: "Session not found" };
      return c.json(err, 404);
    }

    const err: ErrorResponse = {
      error: "Export failed",
      details: message,
    };
    return c.json(err, 500);
  }
});

export default exportRoute;
