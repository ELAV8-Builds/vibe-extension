/// Smart DOM extraction — produces a token-efficient snapshot of the page.
///
/// Token budget strategy:
/// - Simple pages (blog, landing): < 5KB, full extraction
/// - Medium pages (e-commerce, dashboard): < 10KB, moderate collapsing
/// - Complex pages (web app, SPA): < 15KB, aggressive collapsing + viewport focus
///
/// The extractor estimates output size during traversal and switches to
/// more aggressive collapsing when approaching the budget.

import type { DOMSnapshot, DOMNode, DesignTokens } from "../shared/types";
import {
  MAX_DOM_DEPTH,
  MAX_TEXT_LENGTH,
  COLLAPSED_THRESHOLD,
  MAX_SNAPSHOT_SIZE_KB,
} from "../shared/constants";

// Tags to completely strip
const STRIP_TAGS = new Set([
  "SCRIPT",
  "NOSCRIPT",
  "STYLE",
  "LINK",
  "META",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "TEMPLATE",
  "SLOT",
]);

// Tags that indicate ad/tracking containers to skip
const AD_SELECTORS = [
  '[class*="ad-"]',
  '[class*="ads-"]',
  '[class*="advert"]',
  '[id*="google_ads"]',
  '[data-ad]',
  '[aria-label="advertisement"]',
];

// Style properties to capture
const STYLE_PROPS = [
  "color",
  "background-color",
  "font-family",
  "font-size",
  "font-weight",
  "padding",
  "margin",
  "display",
  "flex-direction",
  "gap",
  "border-radius",
  "width",
  "height",
] as const;

// Default computed style values to skip
const DEFAULT_VALUES: Record<string, string[]> = {
  color: ["rgb(0, 0, 0)"],
  "background-color": ["rgba(0, 0, 0, 0)", "transparent"],
  "font-weight": ["400", "normal"],
  display: ["block", "inline"],
  padding: ["0px"],
  margin: ["0px"],
  gap: ["normal", "0px"],
  "flex-direction": ["row"],
  "border-radius": ["0px"],
};

/** Rough estimate of a DOMNode's JSON size in bytes. */
function estimateNodeSize(node: DOMNode): number {
  let size = 20; // base overhead for tag, braces, etc.
  if (node.id) size += node.id.length + 8;
  if (node.classes) size += node.classes.join(",").length + 14;
  if (node.styles) {
    for (const [k, v] of Object.entries(node.styles)) {
      size += k.length + v.length + 6;
    }
  }
  if (node.text) size += node.text.length + 10;
  if (node.bounds) size += 40;
  if (node.collapsed) size += node.collapsed.length + 16;
  if (node.children) {
    for (const child of node.children) {
      size += estimateNodeSize(child);
    }
  }
  return size;
}

/** Check if an element matches any ad-related selector. */
function isAdElement(el: Element): boolean {
  try {
    for (const sel of AD_SELECTORS) {
      if (el.matches(sel)) return true;
    }
  } catch {
    // Invalid selector or unsupported, skip
  }
  return false;
}

export function extractDOMSnapshot(): DOMSnapshot {
  const colorMap = new Map<string, { count: number; usage: string }>();
  const fontMap = new Map<
    string,
    { weights: Set<number>; usage: string }
  >();
  const spacingSet = new Set<number>();
  const radiiSet = new Set<number>();
  let totalElements = 0;
  let extractedElements = 0;
  let estimatedSize = 0;

  // Budget in bytes (KB * 1024)
  const sizeBudget = MAX_SNAPSHOT_SIZE_KB * 1024;

  // Dynamic depth limit — reduced when approaching budget
  let effectiveMaxDepth = MAX_DOM_DEPTH;
  let effectiveCollapseThreshold = COLLAPSED_THRESHOLD;

  function isVisible(el: Element): boolean {
    try {
      const style = window.getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      ) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch {
      return false;
    }
  }

  function isInViewport(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    const margin = 200; // include elements slightly off-screen
    return (
      rect.bottom > -margin &&
      rect.top < window.innerHeight + margin &&
      rect.right > -margin &&
      rect.left < window.innerWidth + margin
    );
  }

  function isVibeElement(el: Element): boolean {
    const id = el.id || "";
    return id.startsWith("vibe-") || el.getAttribute("data-vibe") === "true";
  }

  function extractNode(el: Element, depth: number): DOMNode | null {
    totalElements++;

    // Budget check — switch to aggressive mode when at 70% capacity
    if (estimatedSize > sizeBudget * 0.7) {
      effectiveMaxDepth = Math.min(effectiveMaxDepth, 5);
      effectiveCollapseThreshold = 2;
    }
    // Hard stop at 90% of budget
    if (estimatedSize > sizeBudget * 0.9) {
      return null;
    }

    if (depth > effectiveMaxDepth) return null;
    if (STRIP_TAGS.has(el.tagName)) return null;
    if (isVibeElement(el)) return null;
    if (isAdElement(el)) return null;
    if (!isVisible(el)) return null;

    // For deep pages past budget threshold, only extract viewport elements
    if (estimatedSize > sizeBudget * 0.5 && depth > 3 && !isInViewport(el)) {
      return null;
    }

    extractedElements++;
    const node: DOMNode = { tag: el.tagName.toLowerCase() };

    // ID and classes
    if (el.id) node.id = el.id;
    const classes = Array.from(el.classList).filter(
      (c) => !c.startsWith("js-") && !c.startsWith("vibe-")
    );
    if (classes.length > 0) {
      // Limit to first 5 classes to save space
      node.classes = classes.slice(0, 5);
    }

    // Computed styles (only non-default)
    const computed = window.getComputedStyle(el);
    const styles: Record<string, string> = {};

    for (const prop of STYLE_PROPS) {
      const val = computed.getPropertyValue(prop);
      if (!val) continue;
      const defaults = DEFAULT_VALUES[prop];
      if (defaults && defaults.includes(val)) continue;
      styles[prop] = val;

      // Track design tokens
      if (prop === "color" || prop === "background-color") {
        const existing = colorMap.get(val);
        if (existing) {
          existing.count++;
        } else {
          colorMap.set(val, { count: 1, usage: prop });
        }
      }
      if (prop === "font-family") {
        const family = val.split(",")[0].trim().replace(/['"]/g, "");
        const weight = parseInt(computed.fontWeight) || 400;
        const existing = fontMap.get(family);
        if (existing) {
          existing.weights.add(weight);
        } else {
          fontMap.set(family, {
            weights: new Set([weight]),
            usage: "body",
          });
        }
      }
      if (prop === "padding" || prop === "margin") {
        const nums = val.match(/\d+/g);
        if (nums) nums.forEach((n) => spacingSet.add(parseInt(n)));
      }
      if (prop === "border-radius") {
        const nums = val.match(/\d+/g);
        if (nums) nums.forEach((n) => radiiSet.add(parseInt(n)));
      }
    }

    if (Object.keys(styles).length > 0) node.styles = styles;

    // Text content
    const directText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim() || "")
      .join(" ")
      .trim();

    if (directText) {
      node.text =
        directText.length > MAX_TEXT_LENGTH
          ? directText.slice(0, MAX_TEXT_LENGTH) + "..."
          : directText;
    }

    // Bounding box
    const rect = el.getBoundingClientRect();
    node.bounds = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    };

    // SVG: keep as placeholder, no children
    if (el.tagName === "SVG" || el.tagName === "svg") {
      node.tag = "svg";
      estimatedSize += estimateNodeSize(node);
      return node;
    }

    // Children with collapsing
    const childElements = Array.from(el.children);
    if (childElements.length > 0) {
      const children: DOMNode[] = [];
      let i = 0;

      while (i < childElements.length) {
        // Budget hard stop
        if (estimatedSize > sizeBudget * 0.9) break;

        const child = childElements[i];

        // Check for repetitive siblings
        let repeatCount = 0;
        let j = i + 1;
        while (j < childElements.length && j - i < 20) {
          const sibling = childElements[j];
          if (
            sibling.tagName === child.tagName &&
            sibling.className === child.className
          ) {
            repeatCount++;
            j++;
          } else {
            break;
          }
        }

        const childNode = extractNode(child, depth + 1);
        if (childNode) {
          children.push(childNode);

          if (repeatCount >= effectiveCollapseThreshold) {
            // Add one more example then collapse
            if (i + 1 < childElements.length) {
              const second = extractNode(childElements[i + 1], depth + 1);
              if (second) children.push(second);
            }

            const collapsedNode: DOMNode = {
              tag: child.tagName.toLowerCase(),
              collapsed: `... ${repeatCount - 1} more <${child.tagName.toLowerCase()}> items`,
            };
            children.push(collapsedNode);
            estimatedSize += estimateNodeSize(collapsedNode);
            i = j;
            continue;
          }
        }

        i++;
      }

      if (children.length > 0) node.children = children;
    }

    estimatedSize += estimateNodeSize(node);
    return node;
  }

  const tree = extractNode(document.body, 0) || {
    tag: "body",
    children: [],
  };

  // Build design tokens
  const designTokens: DesignTokens = {
    colors: Array.from(colorMap.entries())
      .map(([value, data]) => ({
        value,
        count: data.count,
        usage: data.usage,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    fonts: Array.from(fontMap.entries()).map(([family, data]) => ({
      family,
      weights: Array.from(data.weights).sort(),
      usage: data.usage,
    })),
    spacing: Array.from(spacingSet).sort((a, b) => a - b).slice(0, 10),
    radii: Array.from(radiiSet).sort((a, b) => a - b),
  };

  const snapshot: DOMSnapshot = {
    url: window.location.href,
    title: document.title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    designTokens,
    tree,
    totalElements,
    extractedElements,
  };

  // Final size check and log
  const finalSize = JSON.stringify(snapshot).length;
  if (finalSize > sizeBudget) {
    console.warn(
      `[Vibe] DOM snapshot exceeded target size: ${(finalSize / 1024).toFixed(1)}KB (target: ${MAX_SNAPSHOT_SIZE_KB}KB). Extracted ${extractedElements}/${totalElements} elements.`
    );
  }

  return snapshot;
}

// ─── Full Page Source Extractor ───

/**
 * Grab the full rendered HTML, cleaned of scripts, inline styles,
 * vibe-injected elements, and SVG internals. This gives the AI model
 * the real class names, attributes, and nesting structure.
 */
export function extractFullPageSource(): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;

  // Remove vibe-injected elements
  clone.querySelectorAll("[data-vibe], #vibe-changes, #vibe-animations").forEach((el) => el.remove());

  // Hollow out <script> tags — keep the tag so structure is visible
  clone.querySelectorAll("script").forEach((el) => {
    el.textContent = "";
  });

  // Hollow out <style> tags — CSS is sent separately
  clone.querySelectorAll("style").forEach((el) => {
    el.textContent = "";
  });

  // Collapse SVG internals to save space
  clone.querySelectorAll("svg").forEach((el) => {
    const attrs = Array.from(el.attributes)
      .map((a) => `${a.name}="${a.value}"`)
      .join(" ");
    const placeholder = document.createElement("svg");
    for (const attr of el.attributes) {
      placeholder.setAttribute(attr.name, attr.value);
    }
    placeholder.innerHTML = "<!-- icon -->";
    el.replaceWith(placeholder);
  });

  // Remove iframes, objects, embeds
  clone.querySelectorAll("iframe, object, embed").forEach((el) => el.remove());

  let html = clone.outerHTML;

  // Collapse runs of whitespace/blank lines
  html = html.replace(/\n\s*\n/g, "\n");
  html = html.replace(/[ \t]{2,}/g, " ");

  return html;
}

// ─── Active CSS Rules Extractor ───

/**
 * Collect CSS rules from all accessible same-origin stylesheets.
 * Cross-origin sheets are skipped (they throw on .cssRules access).
 */
const NOISE_AT_RULES = new Set(["@font-face", "@keyframes", "@-webkit-keyframes", "@-moz-keyframes"]);
const MAX_RULE_LENGTH = 2000;

function isNoiseRule(rule: CSSRule): boolean {
  const text = rule.cssText;

  // Skip @font-face and @keyframes — large, not useful for design changes
  for (const prefix of NOISE_AT_RULES) {
    if (text.startsWith(prefix)) return true;
  }

  // Skip rules with base64 data URIs (background images, custom fonts)
  if (text.includes("base64,")) return true;

  // Skip extremely long rules (usually generated/minified blobs)
  if (text.length > MAX_RULE_LENGTH) return true;

  return false;
}

const MAX_STYLES_OUTPUT = 500000;

export function extractPageStyles(): string {
  const seen = new Set<string>();
  const rules: string[] = [];
  let totalLength = 0;

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const ownerNode = sheet.ownerNode;
      if (ownerNode instanceof HTMLElement) {
        if (
          ownerNode.id === "vibe-changes" ||
          ownerNode.id === "vibe-animations" ||
          ownerNode.getAttribute("data-vibe") === "true"
        ) {
          continue;
        }
      }

      const cssRules = sheet.cssRules;
      if (!cssRules) continue;

      for (const rule of Array.from(cssRules)) {
        if (isNoiseRule(rule)) continue;

        const text = rule.cssText;
        if (seen.has(text)) continue;

        if (totalLength + text.length > MAX_STYLES_OUTPUT) break;

        seen.add(text);
        rules.push(text);
        totalLength += text.length + 1;
      }

      if (totalLength >= MAX_STYLES_OUTPUT) break;
    } catch {
      // Cross-origin sheet — skip
    }
  }

  return rules.join("\n");
}
