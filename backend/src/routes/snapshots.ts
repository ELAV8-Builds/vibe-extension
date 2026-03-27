import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import { SaveSnapshotRequestSchema } from "../types/api";
import type { SnapshotListResponse, ErrorResponse } from "../types/api";
import type { Snapshot } from "../types/session";

const snapshots = new Hono();

/**
 * POST /api/snapshots — Save a snapshot of the current page state.
 */
snapshots.post("/api/snapshots", async (c) => {
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

  const parsed = SaveSnapshotRequestSchema.safeParse(body);

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

    // Verify session exists
    const session = db
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .get(parsed.data.sessionId) as { id: string } | undefined;

    if (!session) {
      const err: ErrorResponse = { error: "Session not found" };
      return c.json(err, 404);
    }

    // Check snapshot limit (max 50 per session)
    const countRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM snapshots WHERE session_id = ?"
      )
      .get(parsed.data.sessionId) as { count: number };

    if (countRow.count >= 50) {
      const err: ErrorResponse = {
        error: "Snapshot limit reached",
        details: "Maximum 50 snapshots per session. Delete older snapshots to continue.",
      };
      return c.json(err, 429);
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Convert base64 thumbnail to Buffer if provided
    let thumbnailBuffer: Buffer | null = null;
    if (parsed.data.thumbnail) {
      try {
        thumbnailBuffer = Buffer.from(parsed.data.thumbnail, "base64");
      } catch {
        // Skip invalid base64 data
      }
    }

    db.prepare(
      `INSERT INTO snapshots (id, session_id, css_state, dom_changes, thumbnail, description, message_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      parsed.data.sessionId,
      parsed.data.cssState,
      parsed.data.domChanges || null,
      thumbnailBuffer,
      parsed.data.description || null,
      parsed.data.messageIndex ?? null,
      now
    );

    const snapshot = db
      .prepare("SELECT * FROM snapshots WHERE id = ?")
      .get(id) as Snapshot;

    return c.json(snapshot, 201);
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to save snapshot",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

/**
 * GET /api/snapshots/:sessionId — List all snapshots for a session.
 */
snapshots.get("/api/snapshots/:sessionId", (c) => {
  try {
    const { sessionId } = c.req.param();
    const db = getDatabase();

    // Verify session exists
    const session = db
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .get(sessionId) as { id: string } | undefined;

    if (!session) {
      const err: ErrorResponse = { error: "Session not found" };
      return c.json(err, 404);
    }

    const rows = db
      .prepare(
        `SELECT id, session_id, css_state, dom_changes, description, message_index, created_at
         FROM snapshots WHERE session_id = ? ORDER BY created_at ASC`
      )
      .all(sessionId) as Snapshot[];

    // Note: We exclude thumbnail from list responses for performance.
    // Thumbnails can be fetched individually if needed.

    const response: SnapshotListResponse = {
      snapshots: rows,
    };

    return c.json(response);
  } catch (error) {
    const err: ErrorResponse = {
      error: "Failed to list snapshots",
      details: error instanceof Error ? error.message : undefined,
    };
    return c.json(err, 500);
  }
});

export default snapshots;
