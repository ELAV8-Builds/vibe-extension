/// Element selector overlay — hover to inspect, click to select.

import { MessageType } from "../shared/messages";
import type { SelectedElement, DOMNode } from "../shared/types";
import {
  SELECTOR_OVERLAY_ID,
  SELECTOR_TOOLTIP_ID,
  MIN_ELEMENT_SIZE,
} from "../shared/constants";

let isActive = false;
let selectedEl: Element | null = null;
let overlayEl: HTMLDivElement | null = null;
let tooltipEl: HTMLDivElement | null = null;
let selectedOverlayEl: HTMLDivElement | null = null;

// ─── Overlay Elements ───

function createOverlay(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = SELECTOR_OVERLAY_ID;
  el.setAttribute("data-vibe", "true");
  Object.assign(el.style, {
    position: "fixed",
    pointerEvents: "none",
    border: "2px solid #e8732a",
    borderRadius: "2px",
    zIndex: "2147483646",
    transition: "all 0.1s ease-out",
    display: "none",
  });
  document.body.appendChild(el);
  return el;
}

function createTooltip(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = SELECTOR_TOOLTIP_ID;
  el.setAttribute("data-vibe", "true");
  Object.assign(el.style, {
    position: "fixed",
    pointerEvents: "none",
    background: "#0f1a2e",
    color: "#e4e8f0",
    fontSize: "11px",
    fontFamily: "system-ui, monospace",
    padding: "4px 8px",
    borderRadius: "4px",
    border: "1px solid #1a2a42",
    zIndex: "2147483647",
    whiteSpace: "nowrap",
    display: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  });
  document.body.appendChild(el);
  return el;
}

function createSelectedOverlay(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("data-vibe", "true");
  Object.assign(el.style, {
    position: "fixed",
    pointerEvents: "none",
    border: "2px dashed #e8732a",
    borderRadius: "2px",
    zIndex: "2147483645",
    display: "none",
  });
  document.body.appendChild(el);
  return el;
}

// ─── Breadcrumb ───

function getBreadcrumb(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body.parentElement) {
    let label = current.tagName.toLowerCase();
    if (current.id) label += `#${current.id}`;
    else if (current.classList.length > 0) {
      label += `.${Array.from(current.classList).slice(0, 2).join(".")}`;
    }
    parts.unshift(label);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

// ─── Unique CSS Selector Builder ───

function getNthOfTypeIndex(el: Element): number {
  const parent = el.parentElement;
  if (!parent) return 1;
  const tag = el.tagName;
  let index = 0;
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tag) index++;
    if (child === el) return index;
  }
  return 1;
}

function buildUniqueSelector(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    if (current === document.body) {
      parts.unshift("body");
      break;
    }

    const tag = current.tagName.toLowerCase();

    if (current.id && !current.id.startsWith("vibe-")) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    let segment = tag;
    const classes = Array.from(current.classList)
      .filter((c) => !c.startsWith("js-") && !c.startsWith("vibe-"))
      .slice(0, 3);
    if (classes.length > 0) {
      segment += classes.map((c) => `.${CSS.escape(c)}`).join("");
    }

    const nthIndex = getNthOfTypeIndex(current);
    const parent = current.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (sameTagSiblings.length > 1) {
        segment += `:nth-of-type(${nthIndex})`;
      }
    }

    parts.unshift(segment);
    current = current.parentElement;
  }

  const selector = parts.join(" > ");

  try {
    const matches = document.querySelectorAll(selector);
    if (matches.length === 1) return selector;
  } catch {
    // fall through
  }

  return selector;
}

// ─── Local Context Extractor ───

const CONTEXT_STYLE_PROPS = [
  "color", "background-color", "font-family", "font-size",
  "font-weight", "padding", "margin", "display", "border-radius",
  "width", "height", "flex-direction", "gap",
] as const;

function extractNodeShallow(el: Element): DOMNode {
  const tag = el.tagName.toLowerCase();
  const node: DOMNode = { tag };

  if (el.id) node.id = el.id;
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith("js-") && !c.startsWith("vibe-"))
    .slice(0, 5);
  if (classes.length > 0) node.classes = classes;

  const computed = window.getComputedStyle(el);
  const styles: Record<string, string> = {};
  for (const prop of CONTEXT_STYLE_PROPS) {
    const val = computed.getPropertyValue(prop);
    if (val) styles[prop] = val;
  }
  if (Object.keys(styles).length > 0) node.styles = styles;

  const directText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent?.trim() || "")
    .join(" ")
    .trim();
  if (directText) {
    node.text = directText.length > 60 ? directText.slice(0, 60) + "..." : directText;
  }

  return node;
}

function getLocalContext(el: Element): DOMNode | undefined {
  const parent = el.parentElement;
  if (!parent || parent === document.documentElement) return undefined;

  const parentNode = extractNodeShallow(parent);
  const children: DOMNode[] = [];

  for (const child of Array.from(parent.children).slice(0, 10)) {
    if (child.getAttribute("data-vibe") === "true") continue;
    children.push(extractNodeShallow(child));
  }

  if (children.length > 0) parentNode.children = children;
  return parentNode;
}

// ─── Element Info ───

function getElementInfo(el: Element): SelectedElement {
  const rect = el.getBoundingClientRect();
  const computed = window.getComputedStyle(el);

  const styles: Record<string, string> = {};
  const props = [
    "color",
    "background-color",
    "font-family",
    "font-size",
    "font-weight",
    "padding",
    "margin",
    "border-radius",
    "display",
  ];

  for (const prop of props) {
    const val = computed.getPropertyValue(prop);
    if (val) styles[prop] = val;
  }

  const textContent = el.textContent?.trim() || undefined;

  const MAX_INNER_HTML = 50000;
  let rawHTML: string | undefined;
  if (el instanceof HTMLElement) {
    rawHTML = el.innerHTML.trim();
    if (rawHTML.length > MAX_INNER_HTML) {
      rawHTML = rawHTML.slice(0, MAX_INNER_HTML) + "<!-- truncated -->";
    }
  }

  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    classes: Array.from(el.classList),
    styles,
    text: textContent
      ? textContent.length > 50
        ? textContent.slice(0, 50) + "..."
        : textContent
      : undefined,
    innerHTML: rawHTML || undefined,
    breadcrumb: getBreadcrumb(el),
    selector: buildUniqueSelector(el),
    context: getLocalContext(el),
    bounds: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
  };
}

// ─── Event Handlers ───

function isVibeElement(el: Element): boolean {
  return (
    el.getAttribute("data-vibe") === "true" ||
    (el.id || "").startsWith("vibe-")
  );
}

function handleMouseMove(e: MouseEvent): void {
  if (!isActive) return;

  const target = e.target as Element;
  if (!target || isVibeElement(target)) return;

  const rect = target.getBoundingClientRect();
  if (rect.width < MIN_ELEMENT_SIZE || rect.height < MIN_ELEMENT_SIZE) return;

  if (!overlayEl) overlayEl = createOverlay();
  if (!tooltipEl) tooltipEl = createTooltip();

  // Position overlay
  Object.assign(overlayEl.style, {
    display: "block",
    top: rect.top - 2 + "px",
    left: rect.left - 2 + "px",
    width: rect.width + 4 + "px",
    height: rect.height + 4 + "px",
  });

  // Position tooltip
  const tag = target.tagName.toLowerCase();
  const id = target.id ? `#${target.id}` : "";
  const cls =
    target.classList.length > 0
      ? `.${Array.from(target.classList).slice(0, 2).join(".")}`
      : "";
  const dims = `${Math.round(rect.width)}x${Math.round(rect.height)}`;

  tooltipEl.textContent = `${tag}${id}${cls}  ${dims}`;
  Object.assign(tooltipEl.style, {
    display: "block",
    top: Math.max(0, rect.top - 28) + "px",
    left: rect.left + "px",
  });
}

function handleClick(e: MouseEvent): void {
  if (!isActive) return;

  const target = e.target as Element;
  if (!target || isVibeElement(target)) return;

  // Prevent default behavior (links, etc.)
  e.preventDefault();
  e.stopPropagation();

  selectedEl = target;

  // Show selected overlay
  if (!selectedOverlayEl) selectedOverlayEl = createSelectedOverlay();
  const rect = target.getBoundingClientRect();
  Object.assign(selectedOverlayEl.style, {
    display: "block",
    top: rect.top - 2 + "px",
    left: rect.left - 2 + "px",
    width: rect.width + 4 + "px",
    height: rect.height + 4 + "px",
  });

  // Send element info to side panel via service worker
  const info = getElementInfo(target);
  chrome.runtime.sendMessage({
    type: MessageType.ELEMENT_SELECTED,
    element: info,
  }).catch(() => {
    // Service worker may not be listening; ignore
  });

  // Disable selector after selection
  disableSelector();
}

// ─── Public API ───

export function enableSelector(): void {
  if (isActive) return;
  isActive = true;

  document.body.style.cursor = "crosshair";
  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("click", handleClick, true);
}

export function disableSelector(): void {
  if (!isActive) return;
  isActive = false;

  document.body.style.cursor = "";
  document.removeEventListener("mousemove", handleMouseMove, true);
  document.removeEventListener("click", handleClick, true);

  // Hide hover overlay and tooltip
  if (overlayEl) overlayEl.style.display = "none";
  if (tooltipEl) tooltipEl.style.display = "none";
}

export function clearSelection(): void {
  selectedEl = null;
  if (selectedOverlayEl) selectedOverlayEl.style.display = "none";
}
