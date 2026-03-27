/// Progress bar and shimmer animations injected into the page.

import {
  VIBE_ANIMATIONS_TAG_ID,
  PROGRESS_BAR_ID,
  SHIMMER_DURATION_MS,
  SHIMMER_STAGGER_MS,
} from "../shared/constants";

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
          box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.5), inset 0 0 0 0 rgba(6, 182, 212, 0.1);
          transform: scale(1);
        }
        30% {
          box-shadow: 0 0 20px 6px rgba(124, 58, 237, 0.3), inset 0 0 30px 0 rgba(6, 182, 212, 0.05);
          transform: scale(1.008);
        }
        60% {
          box-shadow: 0 0 30px 8px rgba(6, 182, 212, 0.2), inset 0 0 20px 0 rgba(124, 58, 237, 0.03);
          transform: scale(1.003);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(124, 58, 237, 0), inset 0 0 0 0 rgba(6, 182, 212, 0);
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

      #${PROGRESS_BAR_ID} {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        z-index: 2147483647;
        overflow: hidden;
        pointer-events: none;
        animation: vibe-fade-in 0.3s ease-out;
        background: rgba(124, 58, 237, 0.1);
      }

      #${PROGRESS_BAR_ID}::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent 0%, #7c3aed 20%, #06b6d4 50%, #7c3aed 80%, transparent 100%);
        animation: vibe-progress-sweep 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        will-change: transform;
      }

      #${PROGRESS_BAR_ID}::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 6px;
        background: linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.4), rgba(6, 182, 212, 0.3), transparent);
        filter: blur(4px);
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
        background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.6), transparent);
        animation: vibe-scan-line 0.8s ease-out forwards;
        pointer-events: none;
      }

      @media (prefers-reduced-motion: reduce) {
        #${PROGRESS_BAR_ID}::before,
        #${PROGRESS_BAR_ID}::after {
          animation: none;
        }
        #${PROGRESS_BAR_ID}::before {
          background: #7c3aed;
          transform: none;
        }
        .vibe-shimmer-effect {
          animation: none;
        }
        .vibe-shimmer-effect::after {
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

export function showProgress(): void {
  getOrCreateAnimationStyle();

  // Cancel any pending hide
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
}

export function hideProgress(): void {
  const bar = document.getElementById(PROGRESS_BAR_ID);
  if (!bar) return;

  bar.classList.add("vibe-fading");

  // Clear any previous timer to avoid stale references
  if (hideProgressTimer) {
    clearTimeout(hideProgressTimer);
  }

  hideProgressTimer = setTimeout(() => {
    hideProgressTimer = null;
    // Re-check: only remove if still fading (showProgress may have been called)
    const currentBar = document.getElementById(PROGRESS_BAR_ID);
    if (currentBar && currentBar.classList.contains("vibe-fading")) {
      currentBar.remove();
    }
  }, 200);
}

// ─── Element Shimmer ───

export function shimmerElements(selectors: string[]): void {
  getOrCreateAnimationStyle();

  // Check if user prefers reduced motion
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
