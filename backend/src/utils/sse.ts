/**
 * Utility functions for Server-Sent Events (SSE) formatting.
 * Provides helpers to construct properly formatted SSE messages
 * for streaming to connected clients.
 */

/**
 * Format a named SSE event with JSON-serialized data.
 *
 * @param event - The event name (e.g., "push", "change", "ping")
 * @param data - The data payload to JSON-serialize
 * @param id - Optional event ID for client-side tracking
 * @returns A properly formatted SSE message string
 */
export function formatSSEEvent(
  event: string,
  data: unknown,
  id?: string
): string {
  let result = "";
  if (id) result += `id: ${id}\n`;
  result += `event: ${event}\n`;
  result += `data: ${JSON.stringify(data)}\n\n`;
  return result;
}

/**
 * Format an SSE comment line.
 * Comments are prefixed with a colon and ignored by clients,
 * but can keep the connection alive.
 *
 * @param comment - The comment text
 * @returns A properly formatted SSE comment string
 */
export function formatSSEComment(comment: string): string {
  return `: ${comment}\n\n`;
}

/**
 * Format an SSE ping event with the current timestamp.
 * Used to keep the connection alive and detect disconnects.
 *
 * @returns A properly formatted SSE ping event string
 */
export function formatSSEPing(): string {
  return formatSSEEvent("ping", { timestamp: Date.now() });
}
