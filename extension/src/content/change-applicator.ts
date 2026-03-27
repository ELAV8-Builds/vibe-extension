/// Manages CSS injection and DOM changes via a single <style> tag.

import type { ChangeInstruction, AppliedChange } from "../shared/types";
import { VIBE_STYLE_TAG_ID } from "../shared/constants";

// ─── State ───

let appliedChanges: AppliedChange[] = [];
let changeCounter = 0;

// ─── Style Tag Management ───

function getOrCreateStyleTag(): HTMLStyleElement {
  let tag = document.getElementById(VIBE_STYLE_TAG_ID) as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = VIBE_STYLE_TAG_ID;
    tag.setAttribute("data-vibe", "true");
    document.head.appendChild(tag);
  }
  return tag;
}

function rebuildStyleTag(): void {
  const tag = getOrCreateStyleTag();
  const cssRules = appliedChanges
    .filter((c) => c.cssRule)
    .map((c) => c.cssRule)
    .join("\n\n");
  tag.textContent = cssRules;
}

// ─── CSS Sanitization ───

/** Maximum number of CSS rules before warning. */
const MAX_CSS_RULES = 1000;

/** Validate that a CSS selector is safe (no url(), no javascript:, no expression()). */
function isSafeSelector(selector: string): boolean {
  const dangerous = /javascript\s*:|expression\s*\(|url\s*\(|@import|\\[0-9a-fA-F]/i;
  return !dangerous.test(selector);
}

/** Validate that a CSS property name is a legitimate CSS property. */
function isSafePropertyName(prop: string): boolean {
  // CSS property names are lowercase alphanumeric with hyphens
  return /^[a-z][a-z0-9-]*$/i.test(prop);
}

/** Validate that a CSS value is safe (no url() with non-data protocols, no expression(), no javascript:). */
function isSafePropertyValue(value: string): boolean {
  const dangerous = /javascript\s*:|expression\s*\(|behavior\s*:|@import|-moz-binding/i;
  return !dangerous.test(value);
}

/** Escape special characters in CSS content (selector/values used in template). */
function escapeCssComment(str: string): string {
  return str.replace(/\*\//g, "* /").replace(/\/\*/g, "/ *");
}

// ─── CSS Change Application ───

function applyCssChange(
  instruction: ChangeInstruction
): { id: string; cssRule: string } | null {
  if (!instruction.selector || !instruction.properties) return null;

  // Validate selector
  if (!isSafeSelector(instruction.selector)) {
    console.warn("[Vibe] Rejected unsafe CSS selector:", instruction.selector);
    return null;
  }

  // Validate the selector actually parses
  try {
    document.querySelector(instruction.selector);
  } catch {
    console.warn("[Vibe] Invalid CSS selector:", instruction.selector);
    return null;
  }

  // Check CSS rule count limit
  if (appliedChanges.filter((c) => c.cssRule).length >= MAX_CSS_RULES) {
    console.warn("[Vibe] Maximum CSS rule limit reached (" + MAX_CSS_RULES + ")");
    return null;
  }

  const id = `vibe-change-${++changeCounter}`;
  const propEntries = Object.entries(instruction.properties).filter(
    ([key, value]) => {
      if (!isSafePropertyName(key)) {
        console.warn("[Vibe] Rejected unsafe CSS property:", key);
        return false;
      }
      if (!isSafePropertyValue(value)) {
        console.warn("[Vibe] Rejected unsafe CSS value for", key, ":", value);
        return false;
      }
      return true;
    }
  );

  if (propEntries.length === 0) return null;

  const props = propEntries
    .map(([key, value]) => {
      // Add !important for higher specificity
      const val = value.endsWith("!important") ? value : `${value} !important`;
      return `  ${key}: ${val};`;
    })
    .join("\n");

  const cssRule = `/* ${escapeCssComment(id)} */\n:root ${instruction.selector} {\n${props}\n}`;

  return { id, cssRule };
}

// ─── DOM Change Application ───

/** Attributes that must never be set via AI-generated instructions. */
const BLOCKED_ATTRIBUTES = new Set([
  "onclick",
  "onload",
  "onerror",
  "onmouseover",
  "onmouseout",
  "onfocus",
  "onblur",
  "onsubmit",
  "onchange",
  "oninput",
  "onkeydown",
  "onkeyup",
  "onkeypress",
  "srcdoc",
  "formaction",
]);

/** Check if an attribute name is a dangerous event handler. */
function isDangerousAttribute(attr: string): boolean {
  const lower = attr.toLowerCase();
  return BLOCKED_ATTRIBUTES.has(lower) || lower.startsWith("on");
}

/** Check if a value contains a dangerous protocol. */
function isDangerousValue(attr: string, value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (attr.toLowerCase() === "href" || attr.toLowerCase() === "src") {
    return lower.startsWith("javascript:") || lower.startsWith("data:text/html");
  }
  return false;
}

function applyDomChange(instruction: ChangeInstruction): boolean {
  if (!instruction.selector || !instruction.action) return false;

  // Validate selector
  if (!isSafeSelector(instruction.selector)) {
    console.warn("[Vibe] Rejected unsafe selector for DOM change:", instruction.selector);
    return false;
  }

  try {
    const elements = document.querySelectorAll(instruction.selector);
    if (elements.length === 0) return false;

    elements.forEach((el) => {
      // Never modify script tags, vibe elements, or event handlers
      if (el.tagName === "SCRIPT" || el.getAttribute("data-vibe") === "true") {
        return;
      }

      switch (instruction.action) {
        case "addClass":
          if (instruction.value) {
            const classes = instruction.value.split(" ").filter((c) => c.trim());
            el.classList.add(...classes);
          }
          break;

        case "removeClass":
          if (instruction.value) {
            const classes = instruction.value.split(" ").filter((c) => c.trim());
            el.classList.remove(...classes);
          }
          break;

        case "setAttribute":
          if (instruction.attribute && instruction.value !== undefined) {
            if (isDangerousAttribute(instruction.attribute)) {
              console.warn("[Vibe] Blocked dangerous attribute:", instruction.attribute);
              return;
            }
            if (isDangerousValue(instruction.attribute, instruction.value)) {
              console.warn("[Vibe] Blocked dangerous attribute value:", instruction.attribute);
              return;
            }
            el.setAttribute(instruction.attribute, instruction.value);
          }
          break;

        case "setText":
          if (instruction.value !== undefined) {
            el.textContent = instruction.value;
          }
          break;

        default:
          break;
      }
    });

    return true;
  } catch (err) {
    console.warn("[Vibe] DOM change failed:", err);
    return false;
  }
}

// ─── Verification + Inline Fallback ───

interface InlineFallback {
  element: HTMLElement;
  property: string;
  previousValue: string;
}

let inlineFallbacks: InlineFallback[] = [];

function normalizeColorValue(val: string): string {
  const trimmed = val.trim().toLowerCase().replace(/\s+/g, "");
  return trimmed.replace(/!important$/, "").trim();
}

function verifyCssChange(
  selector: string,
  properties: Record<string, string>
): { verified: boolean; failedProps: string[]; matchCount: number } {
  const elements = document.querySelectorAll(selector);
  if (elements.length === 0) {
    return { verified: false, failedProps: Object.keys(properties), matchCount: 0 };
  }

  const failedProps: string[] = [];

  for (const [prop, intendedValue] of Object.entries(properties)) {
    const rawValue = intendedValue.replace(/\s*!important\s*$/, "").trim();
    let anyElementMatched = false;

    elements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const actual = computed.getPropertyValue(prop).trim();
      if (normalizeColorValue(actual) === normalizeColorValue(rawValue)) {
        anyElementMatched = true;
      }
    });

    if (!anyElementMatched) {
      failedProps.push(prop);
    }
  }

  return {
    verified: failedProps.length === 0,
    failedProps,
    matchCount: elements.length,
  };
}

function applyInlineFallback(
  selector: string,
  failedProps: string[],
  properties: Record<string, string>
): number {
  const elements = document.querySelectorAll(selector);
  let applied = 0;

  elements.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    for (const prop of failedProps) {
      const value = properties[prop];
      if (!value) continue;
      const rawValue = value.replace(/\s*!important\s*$/, "").trim();

      const previousValue = el.style.getPropertyValue(prop);
      inlineFallbacks.push({ element: el, property: prop, previousValue });

      el.style.setProperty(prop, rawValue, "important");
      applied++;
    }
  });

  return applied;
}

// ─── Public API ───

export interface ChangeFailure {
  selector: string;
  reason: string;
}

export function applyChanges(changes: ChangeInstruction[]): {
  appliedCount: number;
  failedCount: number;
  errors: string[];
  failures: ChangeFailure[];
} {
  const errors: string[] = [];
  const failures: ChangeFailure[] = [];
  let appliedCount = 0;
  let failedCount = 0;

  for (const change of changes) {
    if (change.type === "css") {
      const result = applyCssChange(change);
      if (result) {
        appliedChanges.push({
          id: result.id,
          instruction: change,
          timestamp: Date.now(),
          cssRule: result.cssRule,
        });
        appliedCount++;
      } else {
        const sel = change.selector || "unknown";
        errors.push(`Failed to apply CSS change for selector: ${sel}`);
        failures.push({ selector: sel, reason: "invalid selector or no properties" });
        failedCount++;
      }
    } else if (change.type === "dom") {
      const success = applyDomChange(change);
      if (success) {
        const id = `vibe-dom-${++changeCounter}`;
        appliedChanges.push({
          id,
          instruction: change,
          timestamp: Date.now(),
        });
        appliedCount++;
      } else {
        const sel = change.selector || "unknown";
        errors.push(`Failed to apply DOM change: ${change.action || "unknown"} on ${sel}`);
        failures.push({ selector: sel, reason: `DOM ${change.action || "unknown"} failed` });
        failedCount++;
      }
    }
  }

  rebuildStyleTag();

  // Verify CSS changes and apply inline fallback for overridden properties
  for (const change of changes) {
    if (change.type !== "css" || !change.selector || !change.properties) continue;

    const verification = verifyCssChange(change.selector, change.properties);

    if (verification.matchCount === 0) {
      failures.push({
        selector: change.selector,
        reason: `selector matched 0 elements`,
      });
      failedCount++;
      continue;
    }

    if (!verification.verified) {
      const inlineApplied = applyInlineFallback(
        change.selector,
        verification.failedProps,
        change.properties
      );
      if (inlineApplied > 0) {
        console.log(
          `[Vibe] Inline fallback applied for ${verification.failedProps.length} overridden properties on "${change.selector}"`
        );
      } else {
        failures.push({
          selector: change.selector,
          reason: `properties overridden: ${verification.failedProps.join(", ")}`,
        });
        failedCount++;
      }
    }
  }

  return { appliedCount, failedCount, errors, failures };
}

export function undoLast(): void {
  if (appliedChanges.length === 0) return;
  appliedChanges.pop();
  rebuildStyleTag();
}

export function undoAll(): void {
  appliedChanges = [];
  changeCounter = 0;
  const tag = document.getElementById(VIBE_STYLE_TAG_ID);
  if (tag) {
    tag.textContent = "";
  }

  for (const fb of inlineFallbacks) {
    try {
      if (fb.previousValue) {
        fb.element.style.setProperty(fb.property, fb.previousValue);
      } else {
        fb.element.style.removeProperty(fb.property);
      }
    } catch {
      // Element may no longer exist in the DOM
    }
  }
  inlineFallbacks = [];
}

export function getAppliedChanges(): AppliedChange[] {
  return [...appliedChanges];
}

export function getCssState(): string {
  const tag = document.getElementById(VIBE_STYLE_TAG_ID);
  return tag?.textContent || "";
}

export function setCssState(css: string): void {
  const tag = getOrCreateStyleTag();
  tag.textContent = css;
}

// ─── MutationObserver ───
// Re-apply CSS on dynamic pages (SPAs, lazy loading).
// Debounced to avoid performance issues on heavy pages.

let mutationTimer: ReturnType<typeof setTimeout> | null = null;

const observer = new MutationObserver(() => {
  // Debounce: only check once per 500ms at most
  if (mutationTimer) return;
  mutationTimer = setTimeout(() => {
    mutationTimer = null;
    // CSS persists via the style tag, but ensure the tag still exists
    const tag = document.getElementById(VIBE_STYLE_TAG_ID);
    if (!tag && appliedChanges.length > 0) {
      rebuildStyleTag();
    }
  }, 500);
});

// Watch subtree for SPA navigation and lazy loading
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
