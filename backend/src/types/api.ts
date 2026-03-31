import { z } from "zod";
import type { AIDesignResponse } from "./changes";
import type { Session, Message, Snapshot } from "./session";

// ── Zod schemas for DOM structures ──

/**
 * Zod schema for a DOM node bounds.
 */
const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

/**
 * Zod schema for a simplified DOM node (recursive via z.lazy).
 */
const DOMNodeSchema: z.ZodType<DOMNode> = z.lazy(() =>
  z.object({
    tag: z.string(),
    id: z.string().optional(),
    classes: z.array(z.string()).optional(),
    styles: z.record(z.string(), z.string()).optional(),
    text: z.string().optional(),
    bounds: BoundsSchema.optional(),
    children: z.array(DOMNodeSchema).optional(),
    collapsed: z.string().optional(),
  })
);

/**
 * Zod schema for design tokens.
 */
const DesignTokensSchema = z.object({
  colors: z.array(
    z.object({
      value: z.string(),
      count: z.number(),
      usage: z.string(),
    })
  ),
  fonts: z.array(
    z.object({
      family: z.string(),
      weights: z.array(z.number()),
      usage: z.string(),
    })
  ),
  spacing: z.array(z.number()),
  radii: z.array(z.number()),
});

/**
 * Zod schema for a full DOM snapshot.
 */
const DOMSnapshotSchema = z.object({
  url: z.string(),
  title: z.string(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  designTokens: DesignTokensSchema,
  tree: DOMNodeSchema,
  totalElements: z.number(),
  extractedElements: z.number(),
});

/**
 * DOM node in a simplified snapshot tree.
 */
export interface DOMNode {
  tag: string;
  id?: string;
  classes?: string[];
  styles?: Record<string, string>;
  text?: string;
  bounds?: { x: number; y: number; w: number; h: number };
  children?: DOMNode[];
  collapsed?: string;
}

/**
 * Full DOM snapshot sent from the extension.
 */
export interface DOMSnapshot {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  designTokens: {
    colors: { value: string; count: number; usage: string }[];
    fonts: { family: string; weights: number[]; usage: string }[];
    spacing: number[];
    radii: number[];
  };
  tree: DOMNode;
  totalElements: number;
  extractedElements: number;
}

/**
 * Conversation history message (sent from the extension).
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Selected element schema (enriched with unique selector + local context) ──

const SelectedElementSchema = z.object({
  tag: z.string(),
  id: z.string().optional(),
  classes: z.array(z.string()).optional(),
  styles: z.record(z.string(), z.string()).optional(),
  text: z.string().optional(),
  innerHTML: z.string().max(50000).optional(),
  bounds: BoundsSchema.optional(),
  breadcrumb: z.string().optional(),
  selector: z.string().optional(),
  context: DOMNodeSchema.optional(),
});

export interface SelectedElement {
  tag: string;
  id?: string;
  classes?: string[];
  styles?: Record<string, string>;
  text?: string;
  innerHTML?: string;
  bounds?: { x: number; y: number; w: number; h: number };
  breadcrumb?: string;
  selector?: string;
  context?: DOMNode;
}

// ── Request schemas ──

export const ChatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(10000),
  mode: z.enum(["conversation", "apply"]).default("apply"),
  domSnapshot: DOMSnapshotSchema.optional(),
  pageSource: z.string().max(1000000).optional(),
  pageStyles: z.string().max(1000000).optional(),
  screenshot: z.string().max(5000000).optional(),
  selectedElement: SelectedElementSchema.optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(50)
    .optional(),
});

export const CreateSessionRequestSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().max(500).optional(),
});

export const SaveSnapshotRequestSchema = z.object({
  sessionId: z.string().uuid(),
  cssState: z.string().min(1).max(1024 * 1024), // max 1MB CSS
  domChanges: z.string().max(1024 * 1024).optional(), // max 1MB JSON
  thumbnail: z.string().max(5 * 1024 * 1024).optional(), // base64 encoded, max ~5MB
  description: z.string().max(1000).optional(),
  messageIndex: z.number().int().nonnegative().optional(),
});

// ── Request types ──

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type SaveSnapshotRequest = z.infer<typeof SaveSnapshotRequestSchema>;

// ── Response types ──

export interface ChatResponse {
  sessionId: string;
  messageId: string;
  response: AIDesignResponse;
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
}

export interface SessionDetailResponse {
  session: Session;
  messages: Message[];
}

export interface SnapshotListResponse {
  snapshots: Snapshot[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  uptime: number;
  version: string;
  database: "connected" | "error";
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
