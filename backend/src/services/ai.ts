import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../config";
import type { DOMSnapshot, ConversationMessage, SelectedElement } from "../types/api";
import type { AIDesignResponse } from "../types/changes";
import { simplifySnapshot } from "./dom-processor";
import { parseAIResponse, AIParseError } from "./change-generator";

const MAX_RETRIES = 2;
const MODEL = "claude-opus-4-20250514";

const CONVERSATION_SYSTEM_PROMPT = `You are a world-class web design consultant. The user wants to discuss redesigning a live website. Have a natural conversation about design ideas.

RULES:
1. Discuss design ideas in plain English — talk about colors, typography, layout, spacing, visual hierarchy, etc.
2. Be opinionated and make specific suggestions. Don't be vague.
3. Ask clarifying questions when the user's vision is unclear.
4. Reference the page context (URL, current design tokens) when relevant to ground your suggestions.
5. If the user mentions a selected element, focus your discussion on that element and its context.
6. Do NOT produce code, CSS, or JSON. Just talk about design.
7. Keep responses concise and conversational — 2-4 short paragraphs max.
8. End with 1-2 concrete, actionable design recommendations the user can try next. These should be short imperative phrases (e.g. "Add a dark gradient hero background", "Try 24px bold headings"), NOT questions. The user clicks these to move the design forward.
9. You MUST return valid JSON in this format:

{
  "changes": [],
  "description": "Your conversational response here",
  "suggestions": ["Try a warm amber accent color", "Add more whitespace between sections"]
}

The changes array MUST always be empty in conversation mode. Put your entire response in "description".`;

const APPLY_SYSTEM_PROMPT = `You are a world-class web designer working directly on a live website. You receive a simplified DOM snapshot and the user's design requests. You MUST return valid JSON.

The user has been having a design conversation. Review the full conversation history and produce the final set of changes that implement the agreed-upon design decisions.

Your response format:
{
  "changes": [
    { "type": "css", "selector": "...", "properties": { "property": "value" } },
    { "type": "dom", "action": "addClass|removeClass|setAttribute|setText|replaceHTML|moveElement|wrapElement", "selector": "...", "attribute": "...", "value": "..." }
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
8. Suggest 1-2 actionable next-step recommendations in "suggestions" — short imperative phrases the user can click to continue refining (e.g. "Increase nav padding to 20px", "Soften the border radius"). Never use questions.
9. If the user's request is vague, make an opinionated design choice and explain it.
10. Respect the existing design language unless specifically asked to change it.
11. For layout changes, consider responsive behavior.
12. Never remove content — only restyle or restructure.
13. If you cannot fulfill the request given the DOM context, explain why in "description" and return an empty changes array.
14. When a SELECTED ELEMENT is provided with a CSS selector, use that exact selector for your CSS changes targeting that element. The selector has been verified to uniquely match the element on the page.
15. Synthesize ALL design decisions from the conversation into one cohesive set of changes.
16. DOM action reference:
    - setText: set "value" to the new text content.
    - replaceHTML: set "value" to the new HTML string. This can include <script> tags for interactive features like canvas animations, particle systems, scroll effects, and mouse tracking. Inline scripts are executed on the page. Keep HTML clean and semantic.
    - moveElement: set "value" to the CSS selector of the destination parent to append the element into.
    - wrapElement: set "value" to the wrapper tag name (div, section, etc.) and optionally "attribute" to the wrapper's class name.
17. CSS at-rules: For @keyframes and other at-rules, use the at-rule as the "selector" (e.g. "@keyframes fadeIn") and keyframe stops as property keys with their declarations as values (e.g. "0%": "opacity: 0; transform: translateY(10px)", "100%": "opacity: 1; transform: translateY(0)").
18. When using replaceHTML with scripts: write self-contained inline JavaScript. Never use external CDN scripts unless the user asks. Make canvas/animation code handle window resizing. Use requestAnimationFrame for smooth animations.`;

function buildConversationPrompt(
  message: string,
  pageUrl?: string,
  pageTitle?: string,
  selectedElement?: SelectedElement,
  conversationHistory?: ConversationMessage[]
): string {
  let prompt = "";

  if (pageUrl || pageTitle) {
    prompt += `PAGE CONTEXT:\n`;
    if (pageUrl) prompt += `- URL: ${pageUrl}\n`;
    if (pageTitle) prompt += `- Title: ${pageTitle}\n`;
    prompt += `\n`;
  }

  if (selectedElement) {
    prompt += `SELECTED ELEMENT (user is focused on this element):\n`;
    if (selectedElement.selector) {
      prompt += `- CSS Selector: ${selectedElement.selector}\n`;
    }
    if (selectedElement.breadcrumb) {
      prompt += `- Breadcrumb: ${selectedElement.breadcrumb}\n`;
    }
    prompt += `- Tag: ${selectedElement.tag}`;
    if (selectedElement.id) prompt += `, ID: ${selectedElement.id}`;
    if (selectedElement.classes && selectedElement.classes.length > 0) {
      prompt += `, Classes: [${selectedElement.classes.join(", ")}]`;
    }
    prompt += `\n`;
    if (selectedElement.text) {
      prompt += `- Text: "${selectedElement.text}"\n`;
    }
    if (selectedElement.styles && Object.keys(selectedElement.styles).length > 0) {
      prompt += `- Current Styles: ${JSON.stringify(selectedElement.styles)}\n`;
    }
    if (selectedElement.innerHTML) {
      prompt += `- Current innerHTML:\n${selectedElement.innerHTML}\n`;
    }
    prompt += `\n`;
  }

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-20);
    prompt += `CONVERSATION SO FAR:\n`;
    for (const msg of recentHistory) {
      prompt += `[${msg.role.toUpperCase()}]: ${msg.content}\n`;
    }
    prompt += `\n`;
  }

  prompt += `USER:\n${message}`;
  return prompt;
}

function buildApplyPrompt(
  domSnapshot: DOMSnapshot,
  selectedElement?: SelectedElement,
  conversationHistory?: ConversationMessage[]
): string {
  const simplified = simplifySnapshot(domSnapshot);

  let prompt = "";

  prompt += `PAGE CONTEXT:\n`;
  prompt += `- URL: ${simplified.url}\n`;
  prompt += `- Title: ${simplified.title}\n`;
  prompt += `- Viewport: ${simplified.viewport.width}x${simplified.viewport.height}\n\n`;

  prompt += `DESIGN TOKENS:\n`;
  prompt += `- Colors: ${JSON.stringify(simplified.designTokens.colors.slice(0, 10))}\n`;
  prompt += `- Fonts: ${JSON.stringify(simplified.designTokens.fonts.slice(0, 5))}\n`;
  prompt += `- Spacing scale: ${JSON.stringify(simplified.designTokens.spacing.slice(0, 8))}\n`;
  prompt += `- Border radii: ${JSON.stringify(simplified.designTokens.radii.slice(0, 5))}\n\n`;

  prompt += `DOM STRUCTURE:\n`;
  prompt += JSON.stringify(simplified.tree, null, 2);
  prompt += `\n\n`;

  if (selectedElement) {
    prompt += `SELECTED ELEMENT (user has clicked on this element for focused changes):\n`;
    if (selectedElement.selector) {
      prompt += `- CSS Selector (use this exactly): ${selectedElement.selector}\n`;
    }
    if (selectedElement.breadcrumb) {
      prompt += `- Breadcrumb: ${selectedElement.breadcrumb}\n`;
    }
    prompt += `- Tag: ${selectedElement.tag}`;
    if (selectedElement.id) prompt += `, ID: ${selectedElement.id}`;
    if (selectedElement.classes && selectedElement.classes.length > 0) {
      prompt += `, Classes: [${selectedElement.classes.join(", ")}]`;
    }
    prompt += `\n`;
    if (selectedElement.text) {
      prompt += `- Text: "${selectedElement.text}"\n`;
    }
    if (selectedElement.styles && Object.keys(selectedElement.styles).length > 0) {
      prompt += `- Current Styles: ${JSON.stringify(selectedElement.styles)}\n`;
    }
    if (selectedElement.innerHTML) {
      prompt += `- Current innerHTML (this is what you can replace with replaceHTML):\n`;
      prompt += selectedElement.innerHTML;
      prompt += `\n`;
    }
    if (selectedElement.context) {
      prompt += `- Local Context (parent + siblings):\n`;
      prompt += JSON.stringify(selectedElement.context, null, 2);
      prompt += `\n`;
    }
    prompt += `\n`;
  }

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-20);
    prompt += `DESIGN CONVERSATION (implement all agreed-upon changes):\n`;
    for (const msg of recentHistory) {
      prompt += `[${msg.role.toUpperCase()}]: ${msg.content}\n`;
    }
    prompt += `\n`;
  }

  prompt += `Now produce the final set of CSS/DOM changes that implement everything discussed in the conversation above.`;

  return prompt;
}

export class AIService {
  private client: Anthropic;

  constructor(config: Config) {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  async getDesignChanges(
    message: string,
    mode: "conversation" | "apply",
    domSnapshot?: DOMSnapshot,
    selectedElement?: SelectedElement,
    conversationHistory?: ConversationMessage[]
  ): Promise<AIDesignResponse> {
    if (mode === "conversation") {
      return this.handleConversation(message, domSnapshot, selectedElement, conversationHistory);
    }

    if (!domSnapshot) {
      throw new Error("DOM snapshot is required for apply mode");
    }
    return this.handleApply(domSnapshot, selectedElement, conversationHistory);
  }

  private async handleConversation(
    message: string,
    domSnapshot?: DOMSnapshot,
    selectedElement?: SelectedElement,
    conversationHistory?: ConversationMessage[]
  ): Promise<AIDesignResponse> {
    const userPrompt = buildConversationPrompt(
      message,
      domSnapshot?.url,
      domSnapshot?.title,
      selectedElement,
      conversationHistory
    );

    let lastError: Error | null = null;
    let lastParseError: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const messages: Array<{ role: "user" | "assistant"; content: string }> = [
          { role: "user", content: userPrompt },
        ];

        if (lastParseError && attempt > 0) {
          messages.push({ role: "assistant", content: "(previous malformed response)" });
          messages.push({
            role: "user",
            content: `Your previous response was not valid JSON. Error: ${lastParseError}. Please try again. Remember: return ONLY valid JSON with "changes": [], "description": "your response", "suggestions": [...].`,
          });
        }

        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: CONVERSATION_SYSTEM_PROMPT,
          messages,
        });

        const textBlock = response.content.find((block) => block.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new Error("No text content in AI response");
        }

        const parsed = parseAIResponse(textBlock.text);
        parsed.changes = [];
        return parsed;
      } catch (error) {
        lastError = error as Error;
        if (error instanceof AIParseError && attempt < MAX_RETRIES) {
          lastParseError = error.message;
          continue;
        }
        break;
      }
    }

    throw lastError || new Error("AI service failed after all retries");
  }

  private async handleApply(
    domSnapshot: DOMSnapshot,
    selectedElement?: SelectedElement,
    conversationHistory?: ConversationMessage[]
  ): Promise<AIDesignResponse> {
    const userPrompt = buildApplyPrompt(domSnapshot, selectedElement, conversationHistory);

    let lastError: Error | null = null;
    let lastParseError: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const messages: Array<{ role: "user" | "assistant"; content: string }> = [
          { role: "user", content: userPrompt },
        ];

        if (lastParseError && attempt > 0) {
          messages.push({ role: "assistant", content: "(previous malformed response)" });
          messages.push({
            role: "user",
            content: `Your previous response was not valid JSON. Error: ${lastParseError}. Please try again and return ONLY valid JSON matching the schema.`,
          });
        }

        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: 16384,
          system: APPLY_SYSTEM_PROMPT,
          messages,
        });

        const textBlock = response.content.find((block) => block.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new Error("No text content in AI response");
        }

        return parseAIResponse(textBlock.text);
      } catch (error) {
        lastError = error as Error;
        if (error instanceof AIParseError && attempt < MAX_RETRIES) {
          lastParseError = error.message;
          continue;
        }
        break;
      }
    }

    throw lastError || new Error("AI service failed after all retries");
  }
}
