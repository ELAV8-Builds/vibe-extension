import { getDatabase } from "../db";
import type { Message } from "../types/session";
import type { ChangeInstruction, AIDesignResponse } from "../types/changes";

/**
 * Collect all AI-generated changes from a session's messages.
 */
function collectSessionChanges(
  sessionId: string
): { changes: ChangeInstruction[]; descriptions: string[] } {
  const db = getDatabase();

  const messages = db
    .prepare(
      `SELECT content, role FROM messages
       WHERE session_id = ? AND role = 'assistant'
       ORDER BY created_at ASC`
    )
    .all(sessionId) as Pick<Message, "content" | "role">[];

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
      // Skip messages that aren't valid AI responses
      continue;
    }
  }

  return { changes: allChanges, descriptions };
}

/**
 * Generate a clean, commented CSS export from all session changes.
 */
export function generateCSSExport(sessionId: string): string {
  const db = getDatabase();

  // Get session info for header
  const session = db
    .prepare("SELECT url, title, created_at FROM sessions WHERE id = ?")
    .get(sessionId) as { url: string; title: string | null; created_at: string } | undefined;

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const { changes, descriptions } = collectSessionChanges(sessionId);

  // Filter to CSS-only changes
  const cssChanges = changes.filter((c) => c.type === "css") as Array<{
    type: "css";
    selector: string;
    properties: Record<string, string>;
  }>;

  if (cssChanges.length === 0) {
    return `/* Vibe Design Changes\n * No CSS changes found for this session.\n */\n`;
  }

  // Group changes by selector, merging properties
  const selectorMap = new Map<string, Record<string, string>>();
  for (const change of cssChanges) {
    const existing = selectorMap.get(change.selector) || {};
    Object.assign(existing, change.properties);
    selectorMap.set(change.selector, existing);
  }

  // Build the CSS output
  const lines: string[] = [];

  // Header
  lines.push(`/* Vibe Design Changes`);
  lines.push(` * Source: ${session.url}`);
  if (session.title) {
    lines.push(` * Page: ${session.title}`);
  }
  lines.push(` * Date: ${new Date().toISOString().split("T")[0]}`);
  lines.push(` * Session: ${sessionId}`);
  lines.push(` */`);
  lines.push(``);

  // Description summary
  if (descriptions.length > 0) {
    lines.push(`/* Summary of changes:`);
    for (const desc of descriptions) {
      lines.push(` * - ${desc}`);
    }
    lines.push(` */`);
    lines.push(``);
  }

  // CSS rules
  let ruleIndex = 0;
  for (const [selector, properties] of selectorMap) {
    // Add a description comment if we have one for this change group
    if (ruleIndex < descriptions.length) {
      lines.push(`/* ${descriptions[ruleIndex]} */`);
    }

    lines.push(`${selector} {`);
    for (const [prop, value] of Object.entries(properties)) {
      lines.push(`  ${prop}: ${value};`);
    }
    lines.push(`}`);
    lines.push(``);
    ruleIndex++;
  }

  return lines.join("\n");
}

/**
 * Generate a JSON diff export with all changes and metadata.
 */
export function generateJSONExport(sessionId: string): string {
  const db = getDatabase();

  const session = db
    .prepare("SELECT url, title, created_at FROM sessions WHERE id = ?")
    .get(sessionId) as { url: string; title: string | null; created_at: string } | undefined;

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const { changes, descriptions } = collectSessionChanges(sessionId);

  const exportData = {
    version: "1.0",
    source: session.url,
    title: session.title,
    sessionId,
    created: new Date().toISOString(),
    totalChanges: changes.length,
    descriptions,
    changes: changes.map((change, index) => ({
      id: `c${index + 1}`,
      ...change,
      description: index < descriptions.length ? descriptions[index] : undefined,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}
