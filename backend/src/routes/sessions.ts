import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import { CreateSessionRequestSchema } from "../types/api";
import type {
  SessionListResponse,
  SessionDetailResponse,
  ErrorResponse,
} from "../types/api";
import type { Session, Message } from "../types/session";

const sessions = new Hono();

/**
 * GET /api/sessions — List all sessions, ordered by most recent.
 */
sessions.get("/api/sessions", (c) => {
  try {
    const db = getDatabase();
    const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "50", 10) || 50, 1), 100);
    const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);

    const rows = db
      .prepare(
        `SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as Session[];

    const countRow = db
      .prepare("SELECT COUNT(*) as total FROM sessions")
      .get() as { total: number };

    const response: SessionListResponse = {
      sessions: rows,
      total: countRow.total,
    };

    return c.json(response);
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to list sessions",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * POST /api/sessions — Create a new session.
 */
sessions.post("/api/sessions", async (c) => {
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

  const parsed = CreateSessionRequestSchema.safeParse(body);

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
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();

    db.prepare(
      `INSERT INTO sessions (id, url, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, parsed.data.url, parsed.data.title || null, now, now);

    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as Session;

    return c.json(session, 201);
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to create session",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * GET /api/sessions/:id — Get a session with all its messages.
 */
sessions.get("/api/sessions/:id", (c) => {
  try {
    const { id } = c.req.param();
    const db = getDatabase();

    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as Session | undefined;

    if (!session) {
      const err: ErrorResponse = { error: "Session not found" };
      return c.json(err, 404);
    }

    const messages = db
      .prepare(
        `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`
      )
      .all(id) as Message[];

    const response: SessionDetailResponse = {
      session,
      messages,
    };

    return c.json(response);
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to get session",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * DELETE /api/sessions/:id — Delete a session and all associated data.
 */
sessions.delete("/api/sessions/:id", (c) => {
  try {
    const { id } = c.req.param();
    const db = getDatabase();

    const session = db
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .get(id) as { id: string } | undefined;

    if (!session) {
      const err: ErrorResponse = { error: "Session not found" };
      return c.json(err, 404);
    }

    // CASCADE will handle messages and snapshots
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);

    return c.json({ success: true, deletedSessionId: id });
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to delete session",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

export default sessions;
