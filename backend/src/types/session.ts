/**
 * Session represents a design conversation for a specific page.
 */
export interface Session {
  id: string;
  url: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Message role in a conversation.
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * A single message in a session conversation.
 */
export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  dom_snapshot: string | null;
  created_at: string;
}

/**
 * A snapshot of the page state at a point in time.
 */
export interface Snapshot {
  id: string;
  session_id: string;
  css_state: string;
  dom_changes: string | null;
  thumbnail: Buffer | null;
  description: string | null;
  message_index: number | null;
  created_at: string;
}
