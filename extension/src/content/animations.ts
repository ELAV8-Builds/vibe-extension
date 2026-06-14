/// Progress bar, shimmer, and matrix rain animations injected into the page.

import {
  VIBE_ANIMATIONS_TAG_ID,
  PROGRESS_BAR_ID,
  SHIMMER_DURATION_MS,
  SHIMMER_STAGGER_MS,
} from "../shared/constants";

const MATRIX_CONTAINER_ID = "hibrow-matrix-rain";
const MATRIX_CHARS = [
  "{", "}", "#", ";", ":", "px", "em", "//", "=>", "&&", "||",
  "0", "1", "f()", "[]", "<>", "css", "rgb", "var", "rem", "..",
  "+=", "!=", "->", "::", "%", "**", ">>", "<<",
];
const MATRIX_COLUMN_COUNT = 28;
const MATRIX_DURATION_MS = 2200;

// ─── Animation Style Tag ───

function getOrCreateAnimationStyle(): HTMLStyleElement {
  let tag = document.getElementById(
    VIBE_ANIMATIONS_TAG_ID
  ) as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = VIBE_ANIMATIONS_TAG_ID;
    tag.setAttribute("data-vibe", "true");
    tag.textContent = `
      @keyframes vibe-progress-sweep {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }

      @keyframes vibe-progress-pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }

      @keyframes vibe-shimmer {
        0% {
          box-shadow: 0 0 0 0 rgba(232, 115, 42, 0.5), inset 0 0 0 0 rgba(42, 143, 212, 0.1);
          transform: scale(1);
        }
        30% {
          box-shadow: 0 0 20px 6px rgba(232, 115, 42, 0.3), inset 0 0 30px 0 rgba(42, 143, 212, 0.05);
          transform: scale(1.008);
        }
        60% {
          box-shadow: 0 0 30px 8px rgba(42, 143, 212, 0.2), inset 0 0 20px 0 rgba(232, 115, 42, 0.03);
          transform: scale(1.003);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(232, 115, 42, 0), inset 0 0 0 0 rgba(42, 143, 212, 0);
          transform: scale(1);
        }
      }

      @keyframes vibe-scan-line {
        0% { top: -2px; opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { top: calc(100% + 2px); opacity: 0; }
      }

      @keyframes vibe-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes vibe-fade-out {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      @keyframes vibe-matrix-fall {
        0% { transform: translateY(-20px); opacity: 0; }
        8% { opacity: 1; }
        75% { opacity: 0.6; }
        100% { transform: translateY(calc(100vh + 20px)); opacity: 0; }
      }

      #${MATRIX_CONTAINER_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        pointer-events: none;
        overflow: hidden;
      }

      .hibrow-matrix-col {
        position: absolute;
        top: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        animation: vibe-matrix-fall var(--fall-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--fall-delay) forwards;
        opacity: 0;
        will-change: transform, opacity;
      }

      .hibrow-matrix-char {
        font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
        font-size: var(--char-size, 11px);
        line-height: 1;
        color: #e8732a;
        text-shadow: 0 0 6px rgba(232, 115, 42, 0.7), 0 0 14px rgba(232, 115, 42, 0.3);
        white-space: nowrap;
        opacity: var(--char-opacity, 0.7);
      }

      .hibrow-matrix-char.bright {
        color: #f0944d;
        text-shadow: 0 0 8px rgba(240, 148, 77, 0.9), 0 0 20px rgba(232, 115, 42, 0.5);
        opacity: 1;
      }

      #${PROGRESS_BAR_ID} {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 4px;
        z-index: 2147483647;
        overflow: hidden;
        pointer-events: none;
        animation: vibe-fade-in 0.3s ease-out;
        background: rgba(232, 115, 42, 0.15);
      }

      #${PROGRESS_BAR_ID}::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent 0%, #e8732a 20%, #2a8fd4 50%, #e8732a 80%, transparent 100%);
        animation: vibe-progress-sweep 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        will-change: transform;
      }

      #${PROGRESS_BAR_ID}::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 10px;
        background: linear-gradient(90deg, transparent, rgba(232, 115, 42, 0.5), rgba(42, 143, 212, 0.4), transparent);
        filter: blur(6px);
        animation: vibe-progress-pulse 2s ease-in-out infinite;
        will-change: opacity;
      }

      #${PROGRESS_BAR_ID}.vibe-fading {
        animation: vibe-fade-out 0.3s ease-out forwards;
      }

      .vibe-shimmer-effect {
        animation: vibe-shimmer ${SHIMMER_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        will-change: box-shadow, transform;
        position: relative;
      }

      .vibe-shimmer-effect::after {
        content: '';
        position: absolute;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(42, 143, 212, 0.6), transparent);
        animation: vibe-scan-line 0.8s ease-out forwards;
        pointer-events: none;
      }

      @media (prefers-reduced-motion: reduce) {
        #${PROGRESS_BAR_ID}::before,
        #${PROGRESS_BAR_ID}::after {
          animation: none;
        }
        #${PROGRESS_BAR_ID}::before {
          background: #e8732a;
          transform: none;
        }
        .vibe-shimmer-effect {
          animation: none;
        }
        .vibe-shimmer-effect::after {
          display: none;
        }
        .hibrow-matrix-col {
          animation: none;
          display: none;
        }
      }
    `;
    document.head.appendChild(tag);
  }
  return tag;
}

// ─── Progress Bar ───

let hideProgressTimer: ReturnType<typeof setTimeout> | null = null;
let matrixLoopInterval: ReturnType<typeof setInterval> | null = null;

function startMatrixLoop(): void {
  if (matrixLoopInterval) return;
  showMatrixRain();
  matrixLoopInterval = setInterval(() => {
    showMatrixRain();
  }, MATRIX_DURATION_MS + 300);
}

function stopMatrixLoop(): void {
  if (matrixLoopInterval) {
    clearInterval(matrixLoopInterval);
    matrixLoopInterval = null;
  }
  hideMatrixRain();
}

export function showProgress(): void {
  getOrCreateAnimationStyle();

  if (hideProgressTimer) {
    clearTimeout(hideProgressTimer);
    hideProgressTimer = null;
  }

  let bar = document.getElementById(PROGRESS_BAR_ID);
  if (bar) {
    bar.classList.remove("vibe-fading");
    return;
  }

  bar = document.createElement("div");
  bar.id = PROGRESS_BAR_ID;
  bar.setAttribute("data-vibe", "true");
  document.body.appendChild(bar);

  startMatrixLoop();
}

export function hideProgress(): void {
  stopMatrixLoop();

  const bar = document.getElementById(PROGRESS_BAR_ID);
  if (!bar) return;

  bar.classList.add("vibe-fading");

  if (hideProgressTimer) {
    clearTimeout(hideProgressTimer);
  }

  hideProgressTimer = setTimeout(() => {
    hideProgressTimer = null;
    const currentBar = document.getElementById(PROGRESS_BAR_ID);
    if (currentBar && currentBar.classList.contains("vibe-fading")) {
      currentBar.remove();
    }
  }, 200);
}

// ─── Element Shimmer ───

export function shimmerElements(selectors: string[]): void {
  getOrCreateAnimationStyle();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  selectors.forEach((selector, index) => {
    setTimeout(() => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          el.classList.add("vibe-shimmer-effect");
          setTimeout(() => {
            el.classList.remove("vibe-shimmer-effect");
          }, SHIMMER_DURATION_MS);
        });
      } catch {
        // Invalid selector, skip
      }
    }, index * SHIMMER_STAGGER_MS);
  });
}

// ─── Matrix Rain ───

let matrixTimer: ReturnType<typeof setTimeout> | null = null;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildMatrixColumn(x: number): HTMLDivElement {
  const col = document.createElement("div");
  col.className = "hibrow-matrix-col";
  col.style.left = `${x}%`;

  const charCount = 4 + Math.floor(Math.random() * 6);
  const fallDuration = 1200 + Math.random() * 1000;
  const fallDelay = Math.random() * 800;
  const charSize = 9 + Math.floor(Math.random() * 5);

  col.style.setProperty("--fall-duration", `${fallDuration}ms`);
  col.style.setProperty("--fall-delay", `${fallDelay}ms`);
  col.style.setProperty("--char-size", `${charSize}px`);

  for (let i = 0; i < charCount; i++) {
    const span = document.createElement("span");
    span.className = `hibrow-matrix-char${Math.random() > 0.7 ? " bright" : ""}`;
    span.style.setProperty("--char-opacity", `${0.3 + Math.random() * 0.5}`);
    span.textContent = pickRandom(MATRIX_CHARS);
    col.appendChild(span);
  }

  return col;
}

export function showMatrixRain(): void {
  getOrCreateAnimationStyle();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  let container = document.getElementById(MATRIX_CONTAINER_ID);
  if (container) container.remove();
  if (matrixTimer) {
    clearTimeout(matrixTimer);
    matrixTimer = null;
  }

  container = document.createElement("div");
  container.id = MATRIX_CONTAINER_ID;
  container.setAttribute("data-vibe", "true");

  for (let i = 0; i < MATRIX_COLUMN_COUNT; i++) {
    const x = (i / MATRIX_COLUMN_COUNT) * 100 + Math.random() * (100 / MATRIX_COLUMN_COUNT);
    container.appendChild(buildMatrixColumn(x));
  }

  document.body.appendChild(container);

  matrixTimer = setTimeout(() => {
    matrixTimer = null;
    const el = document.getElementById(MATRIX_CONTAINER_ID);
    if (el) el.remove();
  }, MATRIX_DURATION_MS);
}

export function hideMatrixRain(): void {
  if (matrixTimer) {
    clearTimeout(matrixTimer);
    matrixTimer = null;
  }
  const el = document.getElementById(MATRIX_CONTAINER_ID);
  if (el) el.remove();
}
