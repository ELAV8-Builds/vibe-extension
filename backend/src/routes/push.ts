import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import { MCPDesignPushSchema } from "../types/mcp-client";
import type { MCPPushResult } from "../types/mcp-client";
import type { ErrorResponse } from "../types/api";
import type { PushNotifier } from "../services/push-notifier";

/**
 * Create the push route. Requires a PushNotifier instance to be injected
 * for managing connected clients and broadcasting events.
 *
 * Routes:
 *   POST /api/push          — Accept a design push from an IDE
 *   GET  /api/push/events   — SSE stream for connected extensions
 *   GET  /api/push/clients  — List connected clients
 *   POST /api/push/test     — Send a test notification (development only)
 */
export function createPushRoute(pushNotifier: PushNotifier): Hono {
  const push = new Hono();

  /**
   * POST /api/push — Accept a design push from an IDE.
   * Validates the payload, stores it as a system message in the session,
   * and notifies all connected extension clients.
   */
  push.post("/api/push", async (c) => {
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

    const parsed = MCPDesignPushSchema.safeParse(body);

    if (!parsed.success) {
      const err: ErrorResponse = {
        error: "Invalid push payload",
        details: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      };
      return c.json(err, 400);
    }

    const pushData = parsed.data;

    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      let sessionId: string;

      // Resolve the target to a session ID
      if (pushData.target.type === "session") {
        sessionId = pushData.target.sessionId;

        // Verify session exists
        const existing = db
          .prepare("SELECT id FROM sessions WHERE id = ?")
          .get(sessionId) as { id: string } | undefined;

        if (!existing) {
          const err: ErrorResponse = {
            error: "Session not found",
            details: `No session with ID ${sessionId}`,
          };
          return c.json(err, 404);
        }
      } else {
        // Target by URL — find the most recent session for this URL, or create one
        const existing = db
          .prepare(
            "SELECT id FROM sessions WHERE url = ? ORDER BY updated_at DESC LIMIT 1"
          )
          .get(pushData.target.url) as { id: string } | undefined;

        if (existing) {
          sessionId = existing.id;
        } else {
          // Create a new session for this URL
          sessionId = uuidv4();
          db.prepare(
            `INSERT INTO sessions (id, url, title, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?)`
          ).run(sessionId, pushData.target.url, now, now);
        }
      }

      // Store the push as a system message in the session
      const messageId = uuidv4();
      const messageContent = JSON.stringify({
        type: "mcp_push",
        changes: pushData.changes,
        description: pushData.description,
        source: pushData.source,
      });

      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, created_at)
         VALUES (?, ?, 'system', ?, ?)`
      ).run(messageId, sessionId, messageContent, now);

      // Update session timestamp
      db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
        now,
        sessionId
      );

      // Build the result
      const result: MCPPushResult = {
        success: true,
        sessionId,
        messageId,
        appliedCount: pushData.changes.length,
        failedCount: 0,
      };

      // Notify all connected clients
      pushNotifier.notifyPush(pushData, result);

      return c.json(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown push error";

      console.error("Push endpoint error:", errorMessage);

      const err: ErrorResponse = {
        error: "Push failed",
        details: errorMessage,
      };
      return c.json(err, 500);
    }
  });

  /**
   * GET /api/push/events — Server-Sent Events endpoint for extensions.
   * Connected clients receive real-time notifications when an IDE pushes changes.
   * Sends a ping every 30 seconds to keep the connection alive.
   */
  push.get("/api/push/events", (c) => {
    const clientId = uuidv4();

    return streamSSE(c, async (stream) => {
      // Register the client
      pushNotifier.addClient(clientId, "extension", {
        userAgent: c.req.header("User-Agent") || "unknown",
      });

      // Send initial connection confirmation
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          clientId,
          timestamp: Date.now(),
        }),
        id: uuidv4(),
      });

      // Subscribe to push events
      const unsubscribe = pushNotifier.onEvent(async (event) => {
        try {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.data),
            id: uuidv4(),
          });
        } catch {
          // Stream may have closed — ignore write errors
        }
      });

      // Set up keep-alive ping interval
      const pingInterval = setInterval(async () => {
        try {
          pushNotifier.updatePing(clientId);
          await stream.writeSSE({
            event: "ping",
            data: JSON.stringify({ timestamp: Date.now() }),
          });
        } catch {
          // Stream may have closed — ignore write errors
          clearInterval(pingInterval);
        }
      }, 30_000);

      // Wait for the client to disconnect.
      // We use the abort signal to detect disconnection.
      try {
        await new Promise<void>((_, reject) => {
          c.req.raw.signal.addEventListener("abort", () => {
            reject(new Error("Client disconnected"));
          });
        });
      } catch {
        // Client disconnected — this is expected
      } finally {
        clearInterval(pingInterval);
        unsubscribe();
        pushNotifier.removeClient(clientId);
      }
    });
  });

  /**
   * GET /api/push/clients — List all currently connected clients.
   * Returns an array of ConnectedClient objects.
   */
  push.get("/api/push/clients", (c) => {
    const clients = pushNotifier.getClients();
    return c.json({ clients, total: clients.length });
  });

  /**
   * POST /api/push/test — Send a test notification to all connected clients.
   * Development-only endpoint for verifying SSE connectivity.
   */
  push.post("/api/push/test", (c) => {
    const clients = pushNotifier.getClients();

    if (clients.length === 0) {
      return c.json({
        sent: false,
        message: "No clients connected",
        clients: 0,
      });
    }

    pushNotifier.notifyChange("test-session", [
      {
        type: "css",
        selector: "body",
        properties: { "background-color": "#f0f0f0" },
      },
    ]);

    return c.json({
      sent: true,
      message: `Test notification sent to ${clients.length} client(s)`,
      clients: clients.length,
    });
  });

  return push;
}
