import { z } from "zod";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/index.js";
import { generateCSSExport } from "../services/export.js";
import { SourceMappingService } from "../services/source-mapping.js";
import type { Session, Message } from "../types/session.js";
import type { AIDesignResponse, ChangeInstruction } from "../types/changes.js";

/**
 * Create and configure the Vibe MCP server with all tools and resources.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "vibe-design",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  const sourceMappingService = new SourceMappingService();

  // ── Tools ──

  /**
   * vibe_get_changes — Get all design changes from a session.
   */
  server.tool(
    "vibe_get_changes",
    "Get all design changes from the current or a specific session",
    {
      sessionId: z.string().optional().describe("Session ID (defaults to most recent)"),
    },
    (args) => {
      try {
        const db = getDatabase();
        let targetSessionId = args.sessionId;

        if (!targetSessionId) {
          const latest = db
            .prepare("SELECT id FROM sessions ORDER BY updated_at DESC LIMIT 1")
            .get() as { id: string } | undefined;

          if (!latest) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "No sessions found" }) }],
            };
          }
          targetSessionId = latest.id;
        }

        const messages = db
          .prepare(
            `SELECT content, role FROM messages
             WHERE session_id = ? AND role = 'assistant'
             ORDER BY created_at ASC`
          )
          .all(targetSessionId) as Pick<Message, "content" | "role">[];

        const allChanges: ChangeInstruction[] = [];
        const descriptions: string[] = [];

        for (const msg of messages) {
          try {
            const parsed: AIDesignResponse = JSON.parse(msg.content);
            if (parsed.changes && Array.isArray(parsed.changes)) {
              allChanges.push(...parsed.changes);
            }
            if (parsed.description) {
              descriptions.push(parsed.description);
            }
          } catch {
            continue;
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                sessionId: targetSessionId,
                totalChanges: allChanges.length,
                descriptions,
                changes: allChanges,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * vibe_get_session — Get session details and conversation history.
   */
  server.tool(
    "vibe_get_session",
    "Get session details and conversation history",
    {
      sessionId: z.string().optional().describe("Session ID (defaults to most recent)"),
    },
    (args) => {
      try {
        const db = getDatabase();
        let targetSessionId = args.sessionId;

        if (!targetSessionId) {
          const latest = db
            .prepare("SELECT id FROM sessions ORDER BY updated_at DESC LIMIT 1")
            .get() as { id: string } | undefined;

          if (!latest) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "No sessions found" }) }],
            };
          }
          targetSessionId = latest.id;
        }

        const session = db
          .prepare("SELECT * FROM sessions WHERE id = ?")
          .get(targetSessionId) as Session | undefined;

        if (!session) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Session not found" }) }],
            isError: true,
          };
        }

        const messages = db
          .prepare(
            `SELECT id, session_id, role, content, created_at FROM messages
             WHERE session_id = ? ORDER BY created_at ASC`
          )
          .all(targetSessionId) as Omit<Message, "dom_snapshot">[];

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ session, messages }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * vibe_list_sessions — List all design sessions.
   */
  server.tool(
    "vibe_list_sessions",
    "List all design sessions",
    {
      limit: z.number().int().min(1).max(100).optional().describe("Maximum number of sessions to return (default 10)"),
    },
    (args) => {
      try {
        const db = getDatabase();
        const limit = args.limit ?? 10;

        const sessions = db
          .prepare("SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?")
          .all(limit) as Session[];

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ sessions, total: sessions.length }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * vibe_get_css_export — Get the full CSS export for a session.
   */
  server.tool(
    "vibe_get_css_export",
    "Get the full CSS export for a session",
    {
      sessionId: z.string().describe("Session ID to export CSS for"),
    },
    (args) => {
      try {
        const css = generateCSSExport(args.sessionId);

        return {
          content: [
            {
              type: "text" as const,
              text: css,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Export failed";
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: message }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * vibe_lookup_source — Map a CSS selector to source code location.
   */
  server.tool(
    "vibe_lookup_source",
    "Map a CSS selector to source code location",
    {
      selector: z.string().min(1).describe("CSS selector to look up"),
      minConfidence: z.number().min(0).max(1).optional().describe("Minimum confidence threshold (0-1)"),
    },
    (args) => {
      try {
        const results = sourceMappingService.lookup(args.selector, args.minConfidence);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ selector: args.selector, mappings: results }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * vibe_register_mapping — Register a source code mapping.
   */
  server.tool(
    "vibe_register_mapping",
    "Register a CSS selector to source code mapping",
    {
      selector: z.string().min(1).describe("CSS selector"),
      componentName: z.string().optional().describe("Component name"),
      filePath: z.string().min(1).describe("Source file path"),
      lineNumber: z.number().int().optional().describe("Line number in source file"),
      columnNumber: z.number().int().optional().describe("Column number in source file"),
      confidence: z.number().min(0).max(1).optional().describe("Confidence score (0-1)"),
      source: z.enum(["sourcemap", "heuristic", "manual", "ast"]).optional().describe("How the mapping was determined"),
      projectRoot: z.string().optional().describe("Project root directory"),
      framework: z.string().optional().describe("Framework (e.g., react, vue, angular)"),
    },
    (args) => {
      try {
        const mapping = sourceMappingService.register(args);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(mapping, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * vibe_register_bulk_mappings — Register multiple source mappings at once.
   */
  server.tool(
    "vibe_register_bulk_mappings",
    "Register multiple CSS selector to source code mappings at once",
    {
      mappings: z.array(z.object({
        selector: z.string().min(1),
        componentName: z.string().optional(),
        filePath: z.string().min(1),
        lineNumber: z.number().int().optional(),
        columnNumber: z.number().int().optional(),
        confidence: z.number().min(0).max(1).optional(),
        source: z.enum(["sourcemap", "heuristic", "manual", "ast"]).optional(),
        projectRoot: z.string().optional(),
        framework: z.string().optional(),
      })).min(1).max(1000).describe("Array of source mappings to register"),
      projectRoot: z.string().optional().describe("Default project root for all mappings"),
      framework: z.string().optional().describe("Default framework for all mappings"),
    },
    (args) => {
      try {
        const count = sourceMappingService.registerBulk(
          args.mappings,
          args.projectRoot,
          args.framework
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ registered: count }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * vibe_mapping_stats — Get source mapping statistics.
   */
  server.tool(
    "vibe_mapping_stats",
    "Get source mapping statistics",
    {},
    () => {
      try {
        const stats = sourceMappingService.getStats();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Resources ──

  /**
   * vibe://sessions — List of all design sessions.
   */
  server.resource(
    "sessions-list",
    "vibe://sessions",
    { description: "List of all design sessions" },
    () => {
      const db = getDatabase();
      const sessions = db
        .prepare("SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 50")
        .all() as Session[];

      return {
        contents: [
          {
            uri: "vibe://sessions",
            mimeType: "application/json",
            text: JSON.stringify(sessions, null, 2),
          },
        ],
      };
    }
  );

  /**
   * vibe://session/{sessionId} — Session detail with messages.
   */
  server.resource(
    "session-detail",
    new ResourceTemplate("vibe://session/{sessionId}", { list: undefined }),
    { description: "Session detail with messages" },
    (uri, variables) => {
      const sessionId = String(variables.sessionId);
      const db = getDatabase();

      const session = db
        .prepare("SELECT * FROM sessions WHERE id = ?")
        .get(sessionId) as Session | undefined;

      if (!session) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: "application/json",
              text: JSON.stringify({ error: "Session not found" }),
            },
          ],
        };
      }

      const messages = db
        .prepare(
          `SELECT id, session_id, role, content, created_at FROM messages
           WHERE session_id = ? ORDER BY created_at ASC`
        )
        .all(sessionId) as Omit<Message, "dom_snapshot">[];

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify({ session, messages }, null, 2),
          },
        ],
      };
    }
  );

  /**
   * vibe://changes/{sessionId} — Change instructions for a session.
   */
  server.resource(
    "session-changes",
    new ResourceTemplate("vibe://changes/{sessionId}", { list: undefined }),
    { description: "Change instructions for a session" },
    (uri, variables) => {
      const sessionId = String(variables.sessionId);
      const db = getDatabase();

      const messages = db
        .prepare(
          `SELECT content FROM messages
           WHERE session_id = ? AND role = 'assistant'
           ORDER BY created_at ASC`
        )
        .all(sessionId) as Pick<Message, "content">[];

      const allChanges: ChangeInstruction[] = [];
      const descriptions: string[] = [];

      for (const msg of messages) {
        try {
          const parsed: AIDesignResponse = JSON.parse(msg.content);
          if (parsed.changes && Array.isArray(parsed.changes)) {
            allChanges.push(...parsed.changes);
          }
          if (parsed.description) {
            descriptions.push(parsed.description);
          }
        } catch {
          continue;
        }
      }

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify({
              sessionId,
              totalChanges: allChanges.length,
              descriptions,
              changes: allChanges,
            }, null, 2),
          },
        ],
      };
    }
  );

  /**
   * vibe://mappings/stats — Source mapping statistics.
   */
  server.resource(
    "mapping-stats",
    "vibe://mappings/stats",
    { description: "Source mapping statistics" },
    () => {
      const stats = sourceMappingService.getStats();

      return {
        contents: [
          {
            uri: "vibe://mappings/stats",
            mimeType: "application/json",
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
