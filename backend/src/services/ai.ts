import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../config";
import type { DOMSnapshot, DOMNode, ConversationMessage } from "../types/api";
import type { AIDesignResponse } from "../types/changes";
import { simplifySnapshot } from "./dom-processor";
import { parseAIResponse, AIParseError } from "./change-generator";

const MAX_RETRIES = 2;
const MODEL = "claude-opus-4-6-20250219";

const SYSTEM_PROMPT = `You are a world-class web designer working directly on a live website. You receive a simplified DOM snapshot and the user's design requests. You MUST return valid JSON.

Your response format:
{
  "changes": [
    { "type": "css", "selector": "...", "properties": { "property": "value" } },
    { "type": "dom", "action": "addClass|removeClass|setAttribute|setText", "selector": "...", "attribute": "...", "value": "..." }
  ],
  "description": "What you changed and why",
  "suggestions": ["Follow-up idea 1", "Follow-up idea 2"],
  "reasoning": "Brief technical reasoning"
}

RULES:
1. Return ONLY valid JSON. No markdown, no code fences, no explanatory text before or after.
2. Use CSS selectors that exist in the provided DOM.
3. STRONGLY prefer CSS changes over DOM manipulation.
4. Make targeted changes — don't rewrite everything.
5. Use specific selectors (prefer #id > .class > tag).
6. If adding colors, ensure good contrast ratios (WCAG AA minimum).
7. Explain changes in plain English in "description".
8. Suggest 1-2 natural follow-ups in "suggestions".
9. If the user's request is vague, make an opinionated design choice and explain it.
10. Respect the existing design language unless specifically asked to change it.
11. For layout changes, consider responsive behavior.
12. Never remove content — only restyle or restructure.
13. If you cannot fulfill the request given the DOM context, explain why in "description" and return an empty changes array.`;

/**
 * Build the contextual user prompt with DOM snapshot and conversation history.
 */
function buildUserPrompt(
  message: string,
  domSnapshot: DOMSnapshot,
  selectedElement?: DOMNode,
  conversationHistory?: ConversationMessage[]
): string {
  const simplified = simplifySnapshot(domSnapshot);

  let prompt = "";

  // Page context
  prompt += `PAGE CONTEXT:\n`;
  prompt += `- URL: ${simplified.url}\n`;
  prompt += `- Title: ${simplified.title}\n`;
  prompt += `- Viewport: ${simplified.viewport.width}x${simplified.viewport.height}\n\n`;

  // Design tokens
  prompt += `DESIGN TOKENS:\n`;
  prompt += `- Colors: ${JSON.stringify(simplified.designTokens.colors.slice(0, 10))}\n`;
  prompt += `- Fonts: ${JSON.stringify(simplified.designTokens.fonts.slice(0, 5))}\n`;
  prompt += `- Spacing scale: ${JSON.stringify(simplified.designTokens.spacing.slice(0, 8))}\n`;
  prompt += `- Border radii: ${JSON.stringify(simplified.designTokens.radii.slice(0, 5))}\n\n`;

  // DOM tree (simplified)
  prompt += `DOM STRUCTURE:\n`;
  prompt += JSON.stringify(simplified.tree, null, 2);
  prompt += `\n\n`;

  // Selected element context
  if (selectedElement) {
    prompt += `SELECTED ELEMENT (user has clicked on this element for focused changes):\n`;
    prompt += JSON.stringify(selectedElement, null, 2);
    prompt += `\n\n`;
  }

  // Conversation history (last 10 messages)
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-10);
    prompt += `CONVERSATION SO FAR:\n`;
    for (const msg of recentHistory) {
      prompt += `[${msg.role.toUpperCase()}]: ${msg.content}\n`;
    }
    prompt += `\n`;
  }

  // Current request
  prompt += `USER REQUEST:\n${message}`;

  return prompt;
}

export class AIService {
  private client: Anthropic;

  constructor(config: Config) {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  /**
   * Send a design request to Claude and get structured change instructions.
   * Retries up to MAX_RETRIES times on malformed output.
   */
  async getDesignChanges(
    message: string,
    domSnapshot: DOMSnapshot,
    selectedElement?: DOMNode,
    conversationHistory?: ConversationMessage[]
  ): Promise<AIDesignResponse> {
    const userPrompt = buildUserPrompt(
      message,
      domSnapshot,
      selectedElement,
      conversationHistory
    );

    let lastError: Error | null = null;
    let lastParseError: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Build messages array. On retry, include the previous failed response
        // and a correction prompt to help the model fix its output.
        const messages: Array<{ role: "user" | "assistant"; content: string }> = [
          { role: "user", content: userPrompt },
        ];

        if (lastParseError && attempt > 0) {
          messages.push({
            role: "assistant",
            content: "(previous malformed response)",
          });
          messages.push({
            role: "user",
            content: `Your previous response was not valid JSON. Error: ${lastParseError}. Please try again and return ONLY valid JSON matching the schema.`,
          });
        }

        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages,
        });

        // Extract text from the response
        const textBlock = response.content.find(
          (block) => block.type === "text"
        );
        if (!textBlock || textBlock.type !== "text") {
          throw new Error("No text content in AI response");
        }

        const parsed = parseAIResponse(textBlock.text);
        return parsed;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof AIParseError && attempt < MAX_RETRIES) {
          lastParseError = error.message;
          console.warn(
            `AI response parse failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${error.message}`
          );
          continue;
        }

        // Non-parse errors or final attempt — don't retry
        break;
      }
    }

    throw lastError || new Error("AI service failed after all retries");
  }
}
