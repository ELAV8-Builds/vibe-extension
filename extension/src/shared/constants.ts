// ─── Backend ───
export const DEFAULT_BACKEND_URL = "http://localhost:5100";
export const DEFAULT_API_KEY = "";

// ─── Style Tag IDs ───
export const VIBE_STYLE_TAG_ID = "vibe-changes";
export const VIBE_ANIMATIONS_TAG_ID = "vibe-animations";

// ─── DOM Reader ───
export const MAX_DOM_DEPTH = 8;
export const MAX_TEXT_LENGTH = 50;
export const MAX_SNAPSHOT_SIZE_KB = 10;
export const COLLAPSED_THRESHOLD = 3; // Collapse after this many similar siblings

// ─── Element Selector ───
export const SELECTOR_OVERLAY_ID = "vibe-selector-overlay";
export const SELECTOR_TOOLTIP_ID = "vibe-selector-tooltip";
export const SELECTOR_HIGHLIGHT_CLASS = "vibe-selected-element";
export const MIN_ELEMENT_SIZE = 20; // Ignore elements smaller than this

// ─── Comparison ───
export const COMPARISON_OVERLAY_ID = "vibe-comparison-overlay";

// ─── Snapshots ───
export const MAX_SNAPSHOTS_PER_SESSION = 50;
export const SNAPSHOT_WARNING_THRESHOLD = 40;
export const THUMBNAIL_WIDTH = 280;
export const THUMBNAIL_HEIGHT = 180;

// ─── Animation ───
export const PROGRESS_BAR_ID = "vibe-progress-bar";
export const SHIMMER_DURATION_MS = 600;
export const SHIMMER_STAGGER_MS = 100;

// ─── Storage Keys ───
export const STORAGE_KEY_SETTINGS = "vibe-settings";
export const STORAGE_KEY_SESSION = "vibe-current-session";

// ─── Colors ───
export const COLORS = {
  bg: "#060a13",
  cardBg: "#0f1a2e",
  text: "#e4e8f0",
  textMuted: "#5a7090",
  accent: "#e8732a",
  accentHover: "#f0944d",
  userBubble: "#1a3a5c",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  border: "#1a2a42",
} as const;
