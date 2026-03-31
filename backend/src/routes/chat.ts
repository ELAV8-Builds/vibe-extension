import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import { ChatRequestSchema } from "../types/api";
import type { ChatResponse, ErrorResponse } from "../types/api";
import type { AIService } from "../services/ai";

/**
 * Create the chat route. Requires the AIService instance to be injected.
 */
export function createChatRoute(aiService: AIService): Hono {
  const chat = new Hono();

  /**
   * POST /api/chat — Main AI conversation endpoint.
   * Accepts a message with DOM context, calls the AI, returns structured changes.
   */
  chat.post("/api/chat", async (c) => {
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

    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      const err: ErrorResponse = {
        error: "Invalid request body",
        details: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      };
      return c.json(err, 400);
    }

    const { message, mode, domSnapshot, pageSource, pageStyles, screenshot, selectedElement, conversationHistory } =
      parsed.data;
    let { sessionId } = parsed.data;

    console.log(`[Chat] mode=${mode} screenshot=${screenshot ? `${Math.round(screenshot.length / 1024)}KB` : "none"} pageSource=${pageSource ? `${Math.round(pageSource.length / 1024)}KB` : "none"} pageStyles=${pageStyles ? `${Math.round(pageStyles.length / 1024)}KB` : "none"}`);

    // Guard against excessively large payloads (2MB total for snapshot + source + styles)
    const snapshotSize = domSnapshot ? JSON.stringify(domSnapshot).length : 0;
    const sourceSize = pageSource?.length ?? 0;
    const stylesSize = pageStyles?.length ?? 0;
    const totalContextSize = snapshotSize + sourceSize + stylesSize;
    if (totalContextSize > 2 * 1024 * 1024) {
      const err: ErrorResponse = {
        error: "Page context too large",
        details: `Total context is ${Math.round(totalContextSize / 1024)}KB. Maximum is 2048KB.`,
      };
      return c.json(err, 413);
    }

    try {
      const db = getDatabase();
      const now = new Date().toISOString();

      const pageUrl = domSnapshot?.url || "unknown";
      const pageTitle = domSnapshot?.title || null;

      // Create session if not provided or doesn't exist
      if (!sessionId) {
        sessionId = uuidv4();
        db.prepare(
          `INSERT INTO sessions (id, url, title, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(sessionId, pageUrl, pageTitle, now, now);
      } else {
        // Verify session exists
        const existing = db
          .prepare("SELECT id FROM sessions WHERE id = ?")
          .get(sessionId) as { id: string } | undefined;

        if (!existing) {
          // Create the session on the fly
          db.prepare(
            `INSERT INTO sessions (id, url, title, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`
          ).run(sessionId, pageUrl, pageTitle, now, now);
        }
      }

      // Store the user message
      const userMessageId = uuidv4();
      const snapshotJson = domSnapshot ? JSON.stringify(domSnapshot) : null;
      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, dom_snapshot, created_at)
         VALUES (?, ?, 'user', ?, ?, ?)`
      ).run(
        userMessageId,
        sessionId,
        message,
        snapshotJson,
        now
      );

      // Update session timestamp
      db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
        now,
        sessionId
      );

      // Call AI service
      const aiResponse = await aiService.getDesignChanges(
        message,
        mode,
        domSnapshot,
        selectedElement,
        conversationHistory,
        pageSource,
        pageStyles,
        screenshot
      );

      // Store the AI response
      const aiMessageId = uuidv4();
      const aiNow = new Date().toISOString();
      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, created_at)
         VALUES (?, ?, 'assistant', ?, ?)`
      ).run(aiMessageId, sessionId, JSON.stringify(aiResponse), aiNow);

      const response: ChatResponse = {
        sessionId,
        messageId: aiMessageId,
        response: aiResponse,
      };

      return c.json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown AI service error";

      console.error("Chat endpoint error:", errorMessage);

      // Try to store the error as a system message (best effort)
      if (sessionId) {
        try {
          const db = getDatabase();
          const errorMsgId = uuidv4();
          db.prepare(
            `INSERT INTO messages (id, session_id, role, content, created_at)
             VALUES (?, ?, 'system', ?, ?)`
          ).run(
            errorMsgId,
            sessionId,
            JSON.stringify({ error: errorMessage }),
            new Date().toISOString()
          );
        } catch {
          // Ignore DB errors when storing the error message
        }
      }

      const err: ErrorResponse = {
        error: "AI service error",
        details: errorMessage,
      };
      return c.json(err, 500);
    }
  });

  return chat;
}
