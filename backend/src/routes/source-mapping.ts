import { Hono } from "hono";
import { SourceMappingService } from "../services/source-mapping.js";
import { RegisterMappingSchema, RegisterBulkMappingsSchema } from "../types/source-mapping.js";
import type { ErrorResponse } from "../types/api.js";

const sourceMapping = new Hono();

const service = new SourceMappingService();

/**
 * POST /api/mappings — Register a single source mapping.
 */
sourceMapping.post("/api/mappings", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    const err: ErrorResponse = {
      error: "Invalid JSON",
      details: "Request body must be valid JSON",
    };
    return c.json(err, 400);
  }

  const parsed = RegisterMappingSchema.safeParse(body);

  if (!parsed.success) {
    const err: ErrorResponse = {
      error: "Invalid request body",
      details: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
    return c.json(err, 400);
  }

  try {
    const mapping = service.register(parsed.data);
    return c.json(mapping, 201);
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to register mapping",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * POST /api/mappings/bulk — Bulk register source mappings.
 */
sourceMapping.post("/api/mappings/bulk", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    const err: ErrorResponse = {
      error: "Invalid JSON",
      details: "Request body must be valid JSON",
    };
    return c.json(err, 400);
  }

  const parsed = RegisterBulkMappingsSchema.safeParse(body);

  if (!parsed.success) {
    const err: ErrorResponse = {
      error: "Invalid request body",
      details: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
    return c.json(err, 400);
  }

  try {
    const count = service.registerBulk(
      parsed.data.mappings,
      parsed.data.projectRoot,
      parsed.data.framework
    );
    return c.json({ registered: count }, 201);
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to register bulk mappings",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * GET /api/mappings/lookup — Look up source mapping by CSS selector.
 */
sourceMapping.get("/api/mappings/lookup", (c) => {
  const selector = c.req.query("selector");
  if (!selector) {
    const err: ErrorResponse = {
      error: "Missing required parameter",
      details: 'Query parameter "selector" is required',
    };
    return c.json(err, 400);
  }

  const minConfidenceStr = c.req.query("minConfidence");
  const minConfidence = minConfidenceStr ? parseFloat(minConfidenceStr) : undefined;

  if (minConfidence !== undefined && (isNaN(minConfidence) || minConfidence < 0 || minConfidence > 1)) {
    const err: ErrorResponse = {
      error: "Invalid parameter",
      details: "minConfidence must be a number between 0 and 1",
    };
    return c.json(err, 400);
  }

  try {
    const mappings = service.lookup(selector, minConfidence);
    return c.json({ selector, mappings });
  } catch (error) {
    const err: ErrorResponse = {
      error: "Lookup failed",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * GET /api/mappings/file — Look up source mappings by file path.
 */
sourceMapping.get("/api/mappings/file", (c) => {
  const filePath = c.req.query("path");
  if (!filePath) {
    const err: ErrorResponse = {
      error: "Missing required parameter",
      details: 'Query parameter "path" is required',
    };
    return c.json(err, 400);
  }

  try {
    const mappings = service.lookupByFile(filePath);
    return c.json({ filePath, mappings });
  } catch (error) {
    const err: ErrorResponse = {
      error: "Lookup failed",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * GET /api/mappings/component — Look up source mappings by component name.
 */
sourceMapping.get("/api/mappings/component", (c) => {
  const name = c.req.query("name");
  if (!name) {
    const err: ErrorResponse = {
      error: "Missing required parameter",
      details: 'Query parameter "name" is required',
    };
    return c.json(err, 400);
  }

  try {
    const mappings = service.lookupByComponent(name);
    return c.json({ componentName: name, mappings });
  } catch (error) {
    const err: ErrorResponse = {
      error: "Lookup failed",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * GET /api/mappings/stats — Get source mapping statistics.
 */
sourceMapping.get("/api/mappings/stats", (c) => {
  try {
    const stats = service.getStats();
    return c.json(stats);
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to get stats",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * DELETE /api/mappings/project — Delete all mappings for a project root.
 */
sourceMapping.delete("/api/mappings/project", (c) => {
  const root = c.req.query("root");
  if (!root) {
    const err: ErrorResponse = {
      error: "Missing required parameter",
      details: 'Query parameter "root" is required',
    };
    return c.json(err, 400);
  }

  try {
    const deleted = service.deleteByProject(root);
    return c.json({ deleted, projectRoot: root });
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to delete mappings",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

export default sourceMapping;
