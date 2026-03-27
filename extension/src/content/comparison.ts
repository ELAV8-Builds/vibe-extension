/// Before/after comparison slider overlay.
/// Uses safe DOM construction to avoid XSS risks from data URLs.

import { COMPARISON_OVERLAY_ID } from "../shared/constants";

let overlayEl: HTMLDivElement | null = null;
let isDragging = false;
let dividerPosition = 50; // percentage

/** Validate that a string is a safe data URL (image/png or image/jpeg from captureVisibleTab). */
function isSafeDataUrl(url: string): boolean {
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
}

/** Helper to create a styled element without innerHTML. */
function styledDiv(
  styles: Partial<CSSStyleDeclaration>,
  attrs?: Record<string, string>
): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, styles);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
  }
  return el;
}

function createOverlay(
  originalSrc: string,
  modifiedSrc: string
): HTMLDivElement {
  // Validate data URLs to prevent XSS
  if (!isSafeDataUrl(originalSrc) || !isSafeDataUrl(modifiedSrc)) {
    throw new Error("Invalid screenshot data URL");
  }

  const overlay = document.createElement("div");
  overlay.id = COMPARISON_OVERLAY_ID;
  overlay.setAttribute("data-vibe", "true");

  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2147483647",
    background: "#000",
    cursor: "col-resize",
  });

  // Container
  const container = styledDiv({
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  });

  // Original side (left)
  const originalDiv = styledDiv(
    {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      overflow: "hidden",
    },
    { id: "vibe-comp-original" }
  );
  const originalImg = document.createElement("img");
  originalImg.src = originalSrc;
  originalImg.alt = "Original";
  Object.assign(originalImg.style, { width: "100%", height: "100%", objectFit: "contain" });
  originalDiv.appendChild(originalImg);
  container.appendChild(originalDiv);

  // Modified side (right, clipped)
  const modifiedDiv = styledDiv(
    {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      clipPath: "inset(0 0 0 50%)",
    },
    { id: "vibe-comp-modified" }
  );
  const modifiedImg = document.createElement("img");
  modifiedImg.src = modifiedSrc;
  modifiedImg.alt = "Modified";
  Object.assign(modifiedImg.style, { width: "100%", height: "100%", objectFit: "contain" });
  modifiedDiv.appendChild(modifiedImg);
  container.appendChild(modifiedDiv);

  // Divider line
  const divider = styledDiv(
    {
      position: "absolute",
      top: "0",
      left: "50%",
      width: "3px",
      height: "100%",
      background: "#6366f1",
      transform: "translateX(-50%)",
      zIndex: "1",
    },
    { id: "vibe-comp-divider" }
  );

  // Divider handle (circle with arrows)
  const handle = styledDiv({
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    width: "32px",
    height: "32px",
    background: "#6366f1",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M5 3L2 8L5 13M11 3L14 8L11 13");
  path.setAttribute("stroke", "white");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  handle.appendChild(svg);
  divider.appendChild(handle);
  container.appendChild(divider);

  // Label: Original
  const labelOriginal = styledDiv({
    position: "absolute",
    top: "12px",
    left: "12px",
    background: "rgba(0,0,0,0.6)",
    color: "#e0e0ff",
    fontSize: "12px",
    padding: "4px 10px",
    borderRadius: "4px",
    pointerEvents: "none",
    fontFamily: "system-ui",
  });
  labelOriginal.textContent = "Original";
  container.appendChild(labelOriginal);

  // Label: Modified
  const labelModified = styledDiv({
    position: "absolute",
    top: "12px",
    right: "12px",
    background: "rgba(0,0,0,0.6)",
    color: "#e0e0ff",
    fontSize: "12px",
    padding: "4px 10px",
    borderRadius: "4px",
    pointerEvents: "none",
    fontFamily: "system-ui",
  });
  labelModified.textContent = "Modified";
  container.appendChild(labelModified);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.id = "vibe-comp-close";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "12px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.6)",
    color: "#e0e0ff",
    border: "1px solid #2a2a5e",
    borderRadius: "4px",
    padding: "4px 12px",
    fontSize: "12px",
    cursor: "pointer",
    fontFamily: "system-ui",
    zIndex: "2",
  });
  closeBtn.textContent = "ESC to close";
  container.appendChild(closeBtn);

  overlay.appendChild(container);
  return overlay;
}

function updateDivider(position: number): void {
  const modified = document.getElementById("vibe-comp-modified");
  const divider = document.getElementById("vibe-comp-divider");

  if (modified) {
    modified.style.clipPath = `inset(0 0 0 ${position}%)`;
  }
  if (divider) {
    divider.style.left = `${position}%`;
  }
}

function handleMouseDown(): void {
  isDragging = true;
}

function handleMouseMove(e: MouseEvent): void {
  if (!isDragging || !overlayEl) return;

  const rect = overlayEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  dividerPosition = Math.max(0, Math.min(100, (x / rect.width) * 100));

  // Use requestAnimationFrame for 60fps
  requestAnimationFrame(() => {
    updateDivider(dividerPosition);
  });
}

function handleMouseUp(): void {
  isDragging = false;
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    hideComparison();
  }
}

// ─── Public API ───

export function showComparison(
  originalScreenshot: string,
  modifiedScreenshot: string
): void {
  hideComparison(); // Clean up any existing

  dividerPosition = 50;
  overlayEl = createOverlay(originalScreenshot, modifiedScreenshot);
  document.body.appendChild(overlayEl);

  // Event listeners
  overlayEl.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("keydown", handleKeyDown);

  // Close button
  const closeBtn = document.getElementById("vibe-comp-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", hideComparison);
  }
}

export function hideComparison(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }

  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
  document.removeEventListener("keydown", handleKeyDown);
  isDragging = false;
}
