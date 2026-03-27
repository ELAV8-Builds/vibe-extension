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
      @keyframes vibe-progress-glow {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      @keyframes vibe-shimmer {
        0% {
          box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
          transform: scale(1);
        }
        50% {
          box-shadow: 0 0 12px 4px rgba(99, 102, 241, 0.3);
          transform: scale(1.005);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
          transform: scale(1);
        }
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
        animation: vibe-fade-in 0.2s ease-out;
      }

      #${PROGRESS_BAR_ID}::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, #6366f1, #a855f7, #6366f1, transparent);
        animation: vibe-progress-glow 1.5s ease-in-out infinite;
        will-change: transform;
      }

      #${PROGRESS_BAR_ID}.vibe-fading {
        animation: vibe-fade-out 0.2s ease-out forwards;
      }

      .vibe-shimmer-effect {
        animation: vibe-shimmer ${SHIMMER_DURATION_MS}ms ease-out forwards;
        will-change: box-shadow, transform;
      }

      @media (prefers-reduced-motion: reduce) {
        #${PROGRESS_BAR_ID}::after {
          animation: none;
          background: #6366f1;
        }
        .vibe-shimmer-effect {
          animation: none;
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
