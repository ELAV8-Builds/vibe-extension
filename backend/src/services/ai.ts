import Anthropic from "@anthropic-ai/sdk";
import type { Messages } from "@anthropic-ai/sdk/resources/messages/messages";
import type { Config } from "../config";
import type { DOMSnapshot, ConversationMessage, SelectedElement } from "../types/api";
import type { AIDesignResponse } from "../types/changes";
import { parseAIResponse, AIParseError } from "./change-generator";

const MAX_RETRIES = 2;
const MODEL = "claude-opus-4-20250514";

const CHARS_PER_TOKEN = 3.5;
const MAX_CONTEXT_TOKENS = 200000;
const TOKEN_WARNING_THRESHOLD = 160000;
const MAX_PAGE_SOURCE_CHARS = 400000;
const MAX_PAGE_STYLES_CHARS = 150000;
const MAX_CONVERSATION_SOURCE_CHARS = 120000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

const CONVERSATION_SYSTEM_PROMPT = `You are a world-class web design consultant. The user wants to discuss redesigning a live website. Have a natural conversation about design ideas.

You receive a screenshot of the page as it currently appears, along with its full rendered HTML and active CSS rules. Use the screenshot to understand the visual layout, hierarchy, and current design. Reference what you can see visually and map it to real class names, IDs, and elements from the HTML source.

RULES:
1. Discuss design ideas in plain English — talk about colors, typography, layout, spacing, visual hierarchy, etc.
2. Be opinionated and make specific suggestions. Don't be vague. Reference real selectors/elements from the HTML.
3. Ask clarifying questions when the user's vision is unclear.
4. Reference the page context (URL, design tokens, HTML structure) when relevant to ground your suggestions.
5. If the user mentions a selected element, focus your discussion on that element and its context.
6. Do NOT produce code, CSS, or JSON. Just talk about design.
7. Keep responses concise and conversational — 2-4 short paragraphs max.
8. End with 1-2 suggestions the user can click to keep going. Write them as if the user is responding to you — agreeing and building on your ideas. The first suggestion should accept your main recommendation. The second should accept it AND add something extra. Format: "Yes, [do the thing you suggested]" or "Yes, [do that] and also [add something else]". Keep them under 15 words.
9. You MUST return valid JSON in this format:

{
  "changes": [],
  "description": "Your conversational response here",
  "suggestions": ["Yes, add the dark gradient background", "Yes, add the gradient and also try bolder headings"]
}

The changes array MUST always be empty in conversation mode. Put your entire response in "description".`;

const APPLY_SYSTEM_PROMPT = `You are a world-class web designer working directly on a live website. You receive a screenshot showing the page as it currently looks, along with the FULL rendered HTML and its active CSS stylesheet rules. Use the screenshot to understand the visual layout and what elements look like, then use the HTML/CSS to write precise, accurate selectors and changes. You MUST return valid JSON.

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
2. CRITICAL: Use CSS selectors that ACTUALLY EXIST in the provided HTML source. You have the full page — search it for real class names, IDs, and element structure. Never guess or invent selectors.
3. STRONGLY prefer CSS changes over DOM manipulation.
4. Make targeted changes — don't rewrite everything.
5. Use the most specific selector available from the HTML. Prefer existing classes/IDs over constructed paths. Check the CSS RULES section to understand specificity — your changes need to override existing styles.
6. If adding colors, ensure good contrast ratios (WCAG AA minimum).
7. Explain changes in plain English in "description".
8. Suggest 1-2 next steps the user can click. Write them as if the user is responding — agreeing and building on what was just done. First suggestion: accept what was applied and refine further. Second: accept and add something new on top. Format: "Yes, now [next refinement]" or "Love it, also [add something else]". Keep them under 15 words. Never use questions.
9. If the user's request is vague, make an opinionated design choice and explain it.
10. Respect the existing design language unless specifically asked to change it.
11. For layout changes, consider responsive behavior.
12. Never remove content — only restyle or restructure.
13. If you cannot fulfill the request given the HTML/CSS context, explain why in "description" and return an empty changes array.
14. When a SELECTED ELEMENT is provided with a CSS selector, use that exact selector for your CSS changes targeting that element. The selector has been verified to uniquely match the element on the page.
15. Synthesize ALL design decisions from the conversation into one cohesive set of changes.
16. DOM action reference:
    - setText: set "value" to the new text content.
    - replaceHTML: set "value" to the new HTML string. This can include <script> tags for interactive features like canvas animations, particle systems, scroll effects, and mouse tracking. Inline scripts are executed on the page. Keep HTML clean and semantic.
    - moveElement: set "value" to the CSS selector of the destination parent to append the element into.
    - wrapElement: set "value" to the wrapper tag name (div, section, etc.) and optionally "attribute" to the wrapper's class name.
17. CSS at-rules: For @keyframes and other at-rules, use the at-rule as the "selector" (e.g. "@keyframes fadeIn") and keyframe stops as property keys with their declarations as values (e.g. "0%": "opacity: 0; transform: translateY(10px)", "100%": "opacity: 1; transform: translateY(0)").
18. When using replaceHTML with scripts: write self-contained inline JavaScript. Never use external CDN scripts unless the user asks. Make canvas/animation code handle window resizing. Use requestAnimationFrame for smooth animations.
19. IMPORTANT: The CSS RULES section shows you the page's existing styles. When writing CSS changes, be aware of specificity. If an existing rule uses a highly specific selector, you may need to match or exceed that specificity. Using !important is handled automatically — focus on correct selectors and property names.`;

function buildSelectedElementBlock(selectedElement: SelectedElement): string {
  let block = "";
  if (selectedElement.selector) {
    block += `- CSS Selector (use this exactly): ${selectedElement.selector}\n`;
  }
  if (selectedElement.breadcrumb) {
    block += `- Breadcrumb: ${selectedElement.breadcrumb}\n`;
  }
  block += `- Tag: ${selectedElement.tag}`;
  if (selectedElement.id) block += `, ID: ${selectedElement.id}`;
  if (selectedElement.classes && selectedElement.classes.length > 0) {
    block += `, Classes: [${selectedElement.classes.join(", ")}]`;
  }
  block += `\n`;
  if (selectedElement.text) {
    block += `- Text: "${selectedElement.text}"\n`;
  }
  if (selectedElement.styles && Object.keys(selectedElement.styles).length > 0) {
    block += `- Current Styles: ${JSON.stringify(selectedElement.styles)}\n`;
  }
  if (selectedElement.innerHTML) {
    block += `- Current innerHTML (this is what you can replace with replaceHTML):\n`;
    block += selectedElement.innerHTML;
    block += `\n`;
  }
  if (selectedElement.context) {
    block += `- Local Context (parent + siblings):\n`;
    block += JSON.stringify(selectedElement.context, null, 2);
    block += `\n`;
  }
  return block;
}

function buildConversationPrompt(
  message: string,
  domSnapshot?: DOMSnapshot,
  selectedElement?: SelectedElement,
  conversationHistory?: ConversationMessage[],
  pageSource?: string,
  pageStyles?: string
): string {
  let prompt = "";

  if (domSnapshot) {
    prompt += `PAGE CONTEXT:\n`;
    prompt += `- URL: ${domSnapshot.url}\n`;
    prompt += `- Title: ${domSnapshot.title}\n`;
    prompt += `- Viewport: ${domSnapshot.viewport.width}x${domSnapshot.viewport.height}\n\n`;

    prompt += `DESIGN TOKENS:\n`;
    prompt += `- Colors: ${JSON.stringify(domSnapshot.designTokens.colors.slice(0, 15))}\n`;
    prompt += `- Fonts: ${JSON.stringify(domSnapshot.designTokens.fonts.slice(0, 5))}\n`;
    prompt += `- Spacing scale: ${JSON.stringify(domSnapshot.designTokens.spacing.slice(0, 8))}\n`;
    prompt += `- Border radii: ${JSON.stringify(domSnapshot.designTokens.radii.slice(0, 5))}\n\n`;
  }

  if (pageSource) {
    const truncated = pageSource.slice(0, MAX_CONVERSATION_SOURCE_CHARS);
    const wasTruncated = pageSource.length > MAX_CONVERSATION_SOURCE_CHARS;
    prompt += `PAGE HTML${wasTruncated ? " (truncated)" : ""}:\n`;
    prompt += truncated;
    prompt += `\n\n`;
  }

  if (pageStyles) {
    const stylesBudget = Math.floor(MAX_CONVERSATION_SOURCE_CHARS * 0.4);
    const truncated = pageStyles.slice(0, stylesBudget);
    const wasTruncated = pageStyles.length > stylesBudget;
    prompt += `CSS RULES${wasTruncated ? " (truncated)" : ""}:\n`;
    prompt += truncated;
    prompt += `\n\n`;
  }

  if (selectedElement) {
    prompt += `SELECTED ELEMENT (user is focused on this element):\n`;
    prompt += buildSelectedElementBlock(selectedElement);
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
  conversationHistory?: ConversationMessage[],
  pageSource?: string,
  pageStyles?: string
): string {
  let prompt = "";

  prompt += `PAGE CONTEXT:\n`;
  prompt += `- URL: ${domSnapshot.url}\n`;
  prompt += `- Title: ${domSnapshot.title}\n`;
  prompt += `- Viewport: ${domSnapshot.viewport.width}x${domSnapshot.viewport.height}\n\n`;

  prompt += `DESIGN TOKENS:\n`;
  prompt += `- Colors: ${JSON.stringify(domSnapshot.designTokens.colors.slice(0, 15))}\n`;
  prompt += `- Fonts: ${JSON.stringify(domSnapshot.designTokens.fonts.slice(0, 5))}\n`;
  prompt += `- Spacing scale: ${JSON.stringify(domSnapshot.designTokens.spacing.slice(0, 8))}\n`;
  prompt += `- Border radii: ${JSON.stringify(domSnapshot.designTokens.radii.slice(0, 5))}\n\n`;

  if (pageSource) {
    const truncated = pageSource.slice(0, MAX_PAGE_SOURCE_CHARS);
    const wasTruncated = pageSource.length > MAX_PAGE_SOURCE_CHARS;
    prompt += `FULL PAGE HTML${wasTruncated ? " (truncated — page is very large)" : ""}:\n`;
    prompt += truncated;
    prompt += `\n\n`;
  } else {
    prompt += `DOM STRUCTURE:\n`;
    prompt += JSON.stringify(domSnapshot.tree, null, 2);
    prompt += `\n\n`;
  }

  if (pageStyles) {
    const truncated = pageStyles.slice(0, MAX_PAGE_STYLES_CHARS);
    const wasTruncated = pageStyles.length > MAX_PAGE_STYLES_CHARS;
    prompt += `CSS RULES${wasTruncated ? " (truncated)" : ""}:\n`;
    prompt += truncated;
    prompt += `\n\n`;
  }

  if (selectedElement) {
    prompt += `SELECTED ELEMENT (user has clicked on this element for focused changes):\n`;
    prompt += buildSelectedElementBlock(selectedElement);
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

  prompt += `Now produce the final set of CSS/DOM changes that implement everything discussed in the conversation above. Use selectors from the HTML source above.`;

  return prompt;
}

export class AIService {
  private client: Anthropic;

  constructor(config: Config) {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  private async streamMessage(
    system: string,
    messages: Array<Messages.MessageParam>,
    maxTokens: number
  ): Promise<string> {
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    });

    let text = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
      }
    }

    if (!text) {
      throw new Error("No text content in AI response");
    }

    return text;
  }

  private buildUserContent(
    textPrompt: string,
    screenshot?: string
  ): string | Array<Messages.ContentBlockParam> {
    if (!screenshot) return textPrompt;

    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

    return [
      {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: "image/png" as const,
          data: base64Data,
        },
      },
      { type: "text" as const, text: textPrompt },
    ];
  }

  async getDesignChanges(
    message: string,
    mode: "conversation" | "apply",
    domSnapshot?: DOMSnapshot,
    selectedElement?: SelectedElement,
    conversationHistory?: ConversationMessage[],
    pageSource?: string,
    pageStyles?: string,
    screenshot?: string
  ): Promise<AIDesignResponse> {
    if (mode === "conversation") {
      return this.handleConversation(message, domSnapshot, selectedElement, conversationHistory, pageSource, pageStyles, screenshot);
    }

    if (!domSnapshot) {
      throw new Error("DOM snapshot is required for apply mode");
    }
    return this.handleApply(domSnapshot, selectedElement, conversationHistory, pageSource, pageStyles, screenshot);
  }

  private async handleConversation(
    message: string,
    domSnapshot?: DOMSnapshot,
    selectedElement?: SelectedElement,
    conversationHistory?: ConversationMessage[],
    pageSource?: string,
    pageStyles?: string,
    screenshot?: string
  ): Promise<AIDesignResponse> {
    const userPrompt = buildConversationPrompt(
      message,
      domSnapshot,
      selectedElement,
      conversationHistory,
      pageSource,
      pageStyles
    );

    const promptTokens = estimateTokens(CONVERSATION_SYSTEM_PROMPT + userPrompt);
    const contextWarning = promptTokens > TOKEN_WARNING_THRESHOLD
      ? `This page is very large (~${Math.round(promptTokens / 1000)}K tokens). Responses may be less precise for deeply nested or distant elements.`
      : undefined;

    if (promptTokens > TOKEN_WARNING_THRESHOLD) {
      console.warn(`[AI] Conversation prompt is ~${Math.round(promptTokens / 1000)}K tokens (threshold: ${TOKEN_WARNING_THRESHOLD / 1000}K)`);
    }

    let lastError: Error | null = null;
    let lastParseError: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const messages: Array<Messages.MessageParam> = [
          { role: "user", content: this.buildUserContent(userPrompt, screenshot) },
        ];

        if (lastParseError && attempt > 0) {
          messages.push({ role: "assistant", content: "(previous malformed response)" });
          messages.push({
            role: "user",
            content: `Your previous response was not valid JSON. Error: ${lastParseError}. Please try again. Remember: return ONLY valid JSON with "changes": [], "description": "your response", "suggestions": [...].`,
          });
        }

        const text = await this.streamMessage(CONVERSATION_SYSTEM_PROMPT, messages, 4096);

        const parsed = parseAIResponse(text);
        parsed.changes = [];
        if (contextWarning) {
          parsed.contextWarning = contextWarning;
        }
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
    conversationHistory?: ConversationMessage[],
    pageSource?: string,
    pageStyles?: string,
    screenshot?: string
  ): Promise<AIDesignResponse> {
    const userPrompt = buildApplyPrompt(domSnapshot, selectedElement, conversationHistory, pageSource, pageStyles);

    const promptTokens = estimateTokens(APPLY_SYSTEM_PROMPT + userPrompt);
    const contextWarning = promptTokens > TOKEN_WARNING_THRESHOLD
      ? `This page is very large (~${Math.round(promptTokens / 1000)}K tokens). Some changes may target incorrect selectors on distant elements.`
      : undefined;

    if (promptTokens > TOKEN_WARNING_THRESHOLD) {
      console.warn(`[AI] Apply prompt is ~${Math.round(promptTokens / 1000)}K tokens (threshold: ${TOKEN_WARNING_THRESHOLD / 1000}K)`);
    }

    let lastError: Error | null = null;
    let lastParseError: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const messages: Array<Messages.MessageParam> = [
          { role: "user", content: this.buildUserContent(userPrompt, screenshot) },
        ];

        if (lastParseError && attempt > 0) {
          messages.push({ role: "assistant", content: "(previous malformed response)" });
          messages.push({
            role: "user",
            content: `Your previous response was not valid JSON. Error: ${lastParseError}. Please try again and return ONLY valid JSON matching the schema.`,
          });
        }

        const text = await this.streamMessage(APPLY_SYSTEM_PROMPT, messages, 32000);

        const parsed = parseAIResponse(text);
        if (contextWarning) {
          parsed.contextWarning = contextWarning;
        }
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
}
