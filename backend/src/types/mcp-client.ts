import { z } from "zod";

/**
 * Represents an incoming design push from an IDE via MCP.
 * The IDE sends CSS/DOM changes that should be applied to the active page.
 */
export const MCPDesignPushSchema = z.object({
  /** Target URL or session ID */
  target: z.union([
    z.object({ type: z.literal("url"), url: z.string().url() }),
    z.object({ type: z.literal("session"), sessionId: z.string().uuid() }),
  ]),
  /** Changes to apply */
  changes: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("css"),
          selector: z.string().min(1),
          properties: z.record(z.string(), z.string()),
        }),
        z.object({
          type: z.literal("dom"),
          action: z.enum([
            "addClass",
            "removeClass",
            "setAttribute",
            "setText",
            "moveElement",
            "wrapElement",
          ]),
          selector: z.string().min(1),
          attribute: z.string().optional(),
          value: z.string().optional(),
        }),
      ])
    )
    .min(1),
  /** Human-readable description of the changes */
  description: z.string().max(1000),
  /** Source info (which IDE, which file) */
  source: z
    .object({
      ide: z.string().optional(),
      file: z.string().optional(),
      line: z.number().int().optional(),
    })
    .optional(),
});

export type MCPDesignPush = z.infer<typeof MCPDesignPushSchema>;

/**
 * Result of applying pushed changes.
 */
export interface MCPPushResult {
  success: boolean;
  sessionId: string;
  messageId: string;
  appliedCount: number;
  failedCount: number;
  errors?: string[];
}

/**
 * Webhook configuration for pushing changes to connected extensions.
 */
export const WebhookConfigSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  events: z.array(z.enum(["push", "change", "session"])),
  secret: z.string().optional(),
  active: z.boolean().default(true),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

/**
 * A connected client that can receive pushed changes.
 */
export interface ConnectedClient {
  id: string;
  type: "extension" | "ide" | "webhook";
  connectedAt: string;
  lastPing: string;
  metadata?: Record<string, string>;
}

/**
 * Events emitted by the PushNotifier service.
 */
export interface PushEvent {
  type: "push" | "change" | "ping";
  timestamp: string;
  data: unknown;
}
