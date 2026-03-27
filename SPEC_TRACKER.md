# Vibe — Chrome Extension Spec Tracker

*AI-powered live website redesign, directly in the browser.*

*Created: 2026-03-26*
*Last Updated: 2026-03-26*
*Status: Planning*

---

## Project Overview

Vibe is a Chrome extension that lets users chat with AI to redesign any live website in real-time. The user opens a side panel, describes design changes in natural language, and the AI reads the page's DOM, generates structured change instructions, and applies them live — CSS injection, DOM manipulation, animations, and all. Users can snapshot states, compare before/after, and export clean CSS or JSON diffs.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension UI | React 18 + TypeScript + Tailwind CSS |
| Extension Build | Vite + @crxjs/vite-plugin |
| Extension Manifest | Chrome Manifest V3 |
| State Management | Zustand |
| Backend | Node.js + Hono (lightweight, fast) |
| Database | SQLite (via better-sqlite3) |
| AI | Claude Opus 4.6 via Anthropic API |
| Thumbnails | chrome.tabs.captureVisibleTab() |
| Port | 5100 (backend API) |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Chrome Browser                                         │
│                                                         │
│  ┌──────────────┐    chrome.runtime     ┌────────────┐  │
│  │  Side Panel   │◄────────────────────►│  Service    │  │
│  │  (React App)  │    .sendMessage      │  Worker     │  │
│  │              │                       │  (bg.ts)    │  │
│  │  - Chat UI   │                       │             │  │
│  │  - Snapshots │                       │  - API      │  │
│  │  - Export    │                       │    routing  │  │
│  │  - Settings  │                       │  - Session  │  │
│  └──────────────┘                       │    mgmt     │  │
│                                         └──────┬─────┘  │
│  ┌──────────────────────────────────┐          │        │
│  │  Content Script (per tab)        │          │        │
│  │                                  │◄─────────┘        │
│  │  - DOM Reader                    │  chrome.tabs      │
│  │  - Change Applicator             │  .sendMessage     │
│  │  - Element Selector Overlay      │                   │
│  │  - Progress Animations           │                   │
│  │  - Comparison Slider             │                   │
│  │  - Snapshot Capture              │                   │
│  └──────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ fetch (HTTPS)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Backend API (localhost:5100)                            │
│                                                         │
│  Hono Server                                            │
│  ├── POST /api/chat         → AI conversation           │
│  ├── GET/POST /api/sessions → Session CRUD              │
│  ├── GET/POST /api/snapshots→ Snapshot CRUD             │
│  ├── GET /api/export/:fmt   → CSS / JSON export         │
│  └── GET /health            → Health check              │
│                                                         │
│  Services                                               │
│  ├── AI Service       → Anthropic Claude Opus 4.6       │
│  ├── DOM Processor    → Simplify/analyze DOM context     │
│  ├── Change Generator → Parse AI output → instructions  │
│  └── Export Service   → Generate CSS/JSON artifacts      │
│                                                         │
│  SQLite DB                                              │
│  ├── sessions          (id, url, created_at, ...)       │
│  ├── messages          (id, session_id, role, content)  │
│  ├── snapshots         (id, session_id, changes, thumb) │
│  └── changes           (id, snapshot_id, type, data)    │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Anthropic API
                         ▼
              ┌─────────────────────┐
              │  Claude Opus 4.6    │
              └─────────────────────┘
```

---

## Feature Tracker

| # | Feature | Phase | Status | Notes |
|---|---------|-------|--------|-------|
| 1 | Side Panel Chat UI | 1 | NOT STARTED | React + Tailwind in Chrome side panel |
| 2 | Smart DOM Reader | 1 | NOT STARTED | Token-efficient DOM extraction |
| 3 | AI Design Engine | 2 | NOT STARTED | Claude Opus 4.6 structured output |
| 4 | Live Change Applicator | 2 | NOT STARTED | CSS injection + DOM manipulation |
| 5 | Progress Animation | 3 | NOT STARTED | Glowing progress bar + shimmer effects |
| 6 | Element Targeting | 3 | NOT STARTED | Click-to-select with hover outlines |
| 7 | Snapshot System | 4 | NOT STARTED | Timeline with thumbnails |
| 8 | Before/After Comparison | 4 | NOT STARTED | Draggable slider overlay |
| 9 | Export System | 5 | NOT STARTED | CSS, JSON diff, clipboard |
| 10 | Backend with Session Management | 1 | NOT STARTED | Hono + SQLite + auth |

**Progress: 0 / 10 features complete**

---

## Feature Specifications

### Feature 1: Side Panel Chat UI

*Phase 1 — Foundation*
*Status: NOT STARTED*

The primary user interface. A React app rendered in Chrome's side panel API (not a popup, so it persists while the user interacts with the page).

*Requirements:*

- Chrome side panel registered in manifest.json with `"side_panel"` permission
- React 18 app with TypeScript, bundled by Vite
- Tailwind CSS for styling — dark theme by default (the tool is for designers; it should look premium)
- Zustand store for chat state (messages, current session, loading state, connection status)
- Components:
  - `ChatPanel` — scrollable message list with auto-scroll to bottom
  - `MessageBubble` — user messages (right-aligned, accent color) and AI messages (left-aligned, subtle background). AI messages include the `description` field and clickable `suggestions` as quick-reply chips
  - `MessageInput` — text input with send button, disabled during AI processing, supports Enter to send and Shift+Enter for newlines
  - `SettingsPanel` — backend URL configuration, API key input, theme toggle
- Connection status indicator (green dot = connected to backend, red = disconnected)
- Typing indicator animation while AI is processing
- Error states: backend unreachable, AI error, rate limit — all shown as system messages in the chat
- Side panel header with: Vibe logo/name, current page URL (truncated), settings gear icon
- Responsive within the side panel width constraints (typically 300-400px)

*Key Decisions:*

- Side panel (not popup) because it stays open during page interaction
- Zustand over Redux for simplicity — this is a focused app, not a complex state tree
- Dark theme default because the tool targets designers and developers

*Acceptance Criteria:*

- [ ] Side panel opens from extension icon click
- [ ] Messages display correctly (user right, AI left)
- [ ] Input field sends messages on Enter, supports multiline with Shift+Enter
- [ ] Loading/typing indicator shows during AI processing
- [ ] Settings panel allows backend URL and API key configuration
- [ ] Connection status accurately reflects backend availability
- [ ] Auto-scrolls to newest message

---

### Feature 2: Smart DOM Reader

*Phase 1 — Foundation*
*Status: NOT STARTED*

A content script that extracts a simplified, token-efficient representation of the current page's DOM. This is critical — raw DOM can be 500KB+, but we need to get the AI context under 10KB while preserving enough structure for meaningful design changes.

*Requirements:*

- Content script injected into all pages (with appropriate URL matching)
- Extraction pipeline:
  1. Clone the DOM (to avoid interfering with the live page)
  2. Strip: `<script>`, `<noscript>`, `<style>`, `<link>`, `<meta>`, hidden elements, tracking pixels, ad containers, SVG internals (keep `<svg>` as placeholder), iframes
  3. Collapse repetitive structures: if 10 identical list items exist, keep 2 and note "... 8 more similar"
  4. For each visible element, capture:
     - Tag name
     - id and class attributes (cleaned — remove utility-only classes like `js-` prefixes)
     - Computed style subset: `color`, `background-color`, `font-family`, `font-size`, `font-weight`, `padding`, `margin`, `display`, `flex-direction`, `gap`, `border-radius`, `width`, `height` (only non-default values)
     - Text content (truncated to 50 chars)
     - Bounding box (top, left, width, height — for spatial reasoning)
  5. Extract global design tokens:
     - Color palette (all unique colors used, grouped by frequency)
     - Font stack (all font-families in use)
     - Spacing scale (common padding/margin values)
     - Border radius values
  6. Build a tree structure (nested JSON) with max depth of 8 levels
- Output format: structured JSON under 10KB for a typical page
- Caching: re-extraction only when DOM changes significantly (debounced MutationObserver)
- Ability to extract a focused subtree when the user selects a specific element (Feature 6)

*Output Schema:*

```typescript
interface DOMSnapshot {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  designTokens: {
    colors: { value: string; count: number; usage: string }[];
    fonts: { family: string; weights: number[]; usage: string }[];
    spacing: number[];
    radii: number[];
  };
  tree: DOMNode;
  totalElements: number;
  extractedElements: number;
}

interface DOMNode {
  tag: string;
  id?: string;
  classes?: string[];
  styles?: Record<string, string>; // only non-default computed styles
  text?: string; // truncated
  bounds?: { x: number; y: number; w: number; h: number };
  children?: DOMNode[];
  collapsed?: string; // e.g., "... 8 more <li> items"
}
```

*Token Budget Strategy:*

| Page Complexity | Target Size | Strategy |
|----------------|-------------|----------|
| Simple (blog, landing) | < 5KB | Full extraction, minimal collapsing |
| Medium (e-commerce, dashboard) | < 10KB | Moderate collapsing, skip deep nesting |
| Complex (web app, SPA) | < 15KB | Aggressive collapsing, focus on visible viewport |

*Acceptance Criteria:*

- [ ] Extracts DOM from any webpage without errors
- [ ] Output JSON is under 10KB for typical pages (test on 5 real sites)
- [ ] Design tokens accurately reflect the page's visual design
- [ ] Repetitive structures are collapsed
- [ ] Focused extraction works for individual elements
- [ ] Does not interfere with page functionality (no visible side effects)

---

### Feature 3: AI Design Engine

*Phase 2 — Core Engine*
*Status: NOT STARTED*

The backend endpoint that orchestrates AI conversations. Takes DOM context + user request + conversation history, sends a carefully crafted prompt to Claude Opus 4.6, and returns structured change instructions.

*Requirements:*

- `POST /api/chat` endpoint
- Request body:
  ```typescript
  {
    sessionId: string;
    message: string;
    domSnapshot: DOMSnapshot;        // from Feature 2
    selectedElement?: DOMNode;       // from Feature 6 (optional)
    conversationHistory: Message[];  // last N messages for context
  }
  ```
- System prompt engineering:
  - Role: expert web designer and CSS architect
  - Context: receives the DOM snapshot and design tokens
  - Instructions: return structured JSON with specific CSS changes and optional DOM modifications
  - Constraints: only use selectors that exist in the provided DOM, prefer CSS-only changes over DOM manipulation, keep changes minimal and targeted
  - Style: provide a human-readable description of what was changed and why, plus 1-2 follow-up suggestions
- Response parsing:
  - Validate AI output against the change instruction schema
  - Reject malformed responses with a retry (up to 2 retries)
  - Handle partial responses gracefully
- Conversation history management:
  - Store all messages in SQLite
  - Send last 10 messages as context (sliding window)
  - Include a summary of earlier messages if conversation is long

*AI Response Schema:*

```typescript
interface AIDesignResponse {
  changes: ChangeInstruction[];
  description: string;              // human-readable summary
  suggestions: string[];            // follow-up ideas (max 3)
  reasoning?: string;               // optional: why these changes
}

interface ChangeInstruction {
  type: "css" | "dom";
  // CSS change
  selector?: string;
  properties?: Record<string, string>;
  // DOM change
  action?: "setAttribute" | "addClass" | "removeClass" | "setText" | "moveElement" | "wrapElement";
  attribute?: string;
  value?: string;
}
```

*System Prompt Structure:*

```
You are a world-class web designer working directly on a live website.

CONTEXT:
- Page URL: {url}
- Design tokens: {tokens}
- Page structure: {simplified DOM}
{if selected element: - User has selected this element: {element details}}

CONVERSATION SO FAR:
{last 10 messages}

RULES:
1. Return ONLY valid JSON matching the schema.
2. Use CSS selectors that exist in the provided DOM tree.
3. Prefer CSS changes over DOM manipulation.
4. Make targeted, minimal changes — don't rewrite the whole page.
5. Explain what you changed and why in "description".
6. Suggest 1-2 natural follow-ups in "suggestions".
7. If the user's request is vague, make an opinionated design choice and explain it.
8. Respect the existing design language unless asked to change it.
```

*Acceptance Criteria:*

- [ ] Returns valid structured JSON for design change requests
- [ ] Handles vague requests with sensible defaults ("make it look better")
- [ ] Respects selected element context when provided
- [ ] Conversation history provides coherent multi-turn design sessions
- [ ] Retries on malformed AI output (up to 2 retries)
- [ ] Responds within 5 seconds for typical requests
- [ ] Suggestions are contextually relevant

---

### Feature 4: Live Change Applicator

*Phase 2 — Core Engine*
*Status: NOT STARTED*

The content script module that receives structured change instructions from the AI and applies them to the live page. This is the magic moment — the user sees the page transform in real time.

*Requirements:*

- Single `<style id="vibe-changes">` tag injected into the page `<head>`
  - All CSS changes are aggregated into this one style tag
  - Higher specificity ensured by prefixing selectors with `:root` or using `!important` judiciously
  - Tag is updated (not replaced) to avoid FOUC
- CSS change application:
  - Parse each `ChangeInstruction` with type "css"
  - Build CSS rules from selector + properties
  - Append to the vibe style tag
  - Handle conflicts: later changes override earlier ones for the same selector+property
- DOM change application:
  - Parse each `ChangeInstruction` with type "dom"
  - Execute the action (`setAttribute`, `addClass`, `removeClass`, `setText`, `moveElement`, `wrapElement`)
  - Wrap all DOM changes in a try/catch — never crash the page
- Change tracking:
  - Maintain an ordered list of all applied changes
  - Each change has a unique ID, timestamp, and the original instruction
  - Support undo: removing a change recalculates the style tag from remaining changes
  - Support undo-all: restore page to original state
- Dynamic page handling:
  - MutationObserver watches for page changes (SPA navigation, lazy loading)
  - Re-apply CSS changes automatically (they persist via the style tag)
  - DOM changes may need re-application — track and warn the user
- Safety:
  - Never modify `<script>` tags or event handlers
  - Never modify the extension's own injected elements
  - Sandbox DOM manipulation to prevent XSS
  - Maximum 1000 CSS rules (warn user if approaching limit)

*Change Application Flow:*

```
Service Worker receives AI response
    │
    ▼
chrome.tabs.sendMessage(tabId, { type: "APPLY_CHANGES", changes })
    │
    ▼
Content Script receives message
    │
    ├── CSS changes → update <style id="vibe-changes">
    │
    ├── DOM changes → execute actions with try/catch
    │
    └── Track all changes in local state
    │
    ▼
Send confirmation back to side panel
    │
    ▼
Side panel shows "Changes applied" + description
```

*Acceptance Criteria:*

- [ ] CSS changes are visible immediately on the page
- [ ] DOM changes execute without breaking page functionality
- [ ] Changes persist through scrolling and minor DOM updates
- [ ] Undo removes the most recent change set
- [ ] Undo-all restores the page to its original state
- [ ] Style tag uses appropriate specificity (changes actually override page styles)
- [ ] No interference with the page's JavaScript or event handlers
- [ ] Error handling: failed changes are reported but don't crash the content script

---

### Feature 5: Progress Animation

*Phase 3 — Polish & UX*
*Status: NOT STARTED*

Visual feedback while the AI is processing. Two components: a progress bar at the top of the page and shimmer effects on elements being changed.

*Requirements:*

- *Top Progress Bar:*
  - Fixed position at the very top of the viewport (z-index: 2147483647)
  - 3px tall, full width
  - Gradient animation: subtle glow effect, moves left-to-right
  - Color: brand accent (e.g., electric blue / purple gradient)
  - Appears when AI request is sent, disappears when changes are applied
  - Smooth fade-in and fade-out (200ms)

- *Element Shimmer Effect:*
  - After changes are applied, affected elements get a brief shimmer/morph animation
  - Implementation: CSS `@keyframes` with a subtle outline glow + scale micro-bounce
  - Duration: 600ms per element, staggered by 100ms
  - Non-intrusive: should feel like a gentle "here's what changed" highlight
  - Automatically removed after animation completes

- *Implementation:*
  - All animations via CSS injected in a separate `<style id="vibe-animations">` tag
  - Keyframes defined once, classes toggled on elements
  - Use `will-change` and `transform` for GPU-accelerated animations
  - Respect `prefers-reduced-motion` media query — disable shimmer, keep progress bar static

*Acceptance Criteria:*

- [ ] Progress bar appears during AI processing
- [ ] Progress bar has smooth gradient animation
- [ ] Changed elements shimmer briefly after changes are applied
- [ ] Animations are GPU-accelerated (no jank)
- [ ] Respects prefers-reduced-motion
- [ ] All animation elements are cleaned up (no DOM leaks)

---

### Feature 6: Element Targeting

*Phase 3 — Polish & UX*
*Status: NOT STARTED*

The user can click any element on the page to select it, focusing the AI conversation on that specific section. This gives the user precision control.

*Requirements:*

- *Activation:*
  - Toggle button in the side panel ("Select Element" or crosshair icon)
  - When active, the page enters selection mode
  - Cursor changes to crosshair

- *Hover State:*
  - Mousing over elements shows a blue outline (2px solid, with 2px offset)
  - A small tooltip follows the cursor showing: tag name, id/class, dimensions
  - Outline follows the element's bounding box precisely
  - Skips tiny elements (< 20px in either dimension)
  - Ignores Vibe's own injected elements

- *Selection:*
  - Click selects the element
  - Selected element gets a persistent dashed outline (different from hover)
  - Element details sent to the side panel:
    - Tag, id, classes
    - Computed styles (key subset)
    - Text content preview
    - Position in DOM hierarchy (breadcrumb: `body > main > section.hero > h1`)
  - The AI receives this element as `selectedElement` context in the next message
  - User can click "Clear Selection" to deselect

- *Multi-select (stretch goal):*
  - Hold Shift to select multiple elements
  - All selected elements sent as context

- *Edge Cases:*
  - Clicking inside an input/textarea: don't select, let native behavior work
  - Clicking a link: prevent navigation while in selection mode
  - Scrolling: update outline position
  - Element removed by page JS: gracefully deselect

*Acceptance Criteria:*

- [ ] Hover shows blue outline on elements
- [ ] Tooltip shows element info on hover
- [ ] Click selects element with persistent outline
- [ ] Selected element context is sent to AI with next message
- [ ] Selection mode can be toggled on/off
- [ ] Native interactions (inputs, links) are not broken
- [ ] Breadcrumb path is generated for selected element

---

### Feature 7: Snapshot System

*Phase 4 — History & Comparison*
*Status: NOT STARTED*

Save and restore page states at any point during a design session. Each snapshot is a complete record of all changes applied up to that point.

*Requirements:*

- *Snapshot Capture:*
  - "Save Snapshot" button in the side panel
  - Auto-snapshot after every AI change set is applied (optional, configurable)
  - Each snapshot stores:
    - All CSS rules at that point (the full content of the vibe style tag)
    - All DOM change instructions (for re-application)
    - A thumbnail image (via `chrome.tabs.captureVisibleTab()`, resized to 280x180)
    - Timestamp
    - Auto-generated description (from the AI's `description` field) or user-provided name
    - The conversation message index that created it

- *Snapshot Storage:*
  - Stored in backend SQLite database
  - Thumbnail stored as base64 data URI (or as blob in SQLite)
  - Associated with the current session
  - Maximum 50 snapshots per session (warn at 40)

- *Timeline UI:*
  - Horizontal scrollable filmstrip in the side panel
  - Each snapshot shown as a small thumbnail card with timestamp
  - Current state highlighted
  - Click any snapshot to restore that state
  - Right-click context menu: rename, delete, export

- *State Restoration:*
  - Clicking a snapshot:
    1. Undo all current changes
    2. Re-apply the snapshot's CSS (replace vibe style tag content)
    3. Re-apply DOM changes in order
    4. Scroll position restored if possible
  - Warning if restoring to an earlier state: "This will undo changes after this point"

- *Branching (stretch goal):*
  - After restoring a snapshot, new changes create a branch
  - Timeline shows branch points

*Acceptance Criteria:*

- [ ] Snapshots capture current CSS and DOM change state
- [ ] Thumbnail is generated via Chrome API
- [ ] Timeline displays all snapshots with thumbnails
- [ ] Clicking a snapshot restores the page to that state
- [ ] Snapshots persist across side panel reopens (stored in backend)
- [ ] Auto-snapshot can be enabled/disabled
- [ ] Snapshot limit is enforced with user warning

---

### Feature 8: Before/After Comparison

*Phase 4 — History & Comparison*
*Status: NOT STARTED*

A visual comparison tool that shows the original page and the modified page side by side with a draggable slider.

*Requirements:*

- *Activation:*
  - "Compare" toggle button in the side panel
  - Keyboard shortcut: Ctrl+Shift+V (configurable)

- *Implementation Approach:*
  - Capture a screenshot of the current modified state
  - Remove all vibe changes temporarily (save current state)
  - Capture a screenshot of the original state
  - Re-apply vibe changes
  - Overlay both screenshots with a draggable vertical divider

- *Slider UI:*
  - Full-page overlay (fixed position, covers viewport)
  - Left side: original page screenshot
  - Right side: modified page screenshot
  - Vertical divider line with a drag handle (circle with arrows icon)
  - Dragging moves the divider, revealing more of one side
  - Labels: "Original" on left, "Modified" on right (semi-transparent, top corners)
  - Press Escape or click X to close comparison

- *Alternative: Live DOM mode (if screenshots are insufficient):*
  - Clone the current DOM into a hidden container
  - Strip vibe changes from one copy
  - Display both side-by-side with CSS clip-path for the slider effect
  - More complex but allows interaction (scrolling, hover states)

- *Performance:*
  - Screenshots should be captured once when comparison mode is activated
  - Slider movement should be 60fps (CSS transforms only)
  - Large pages: limit screenshot resolution to viewport size

*Acceptance Criteria:*

- [ ] Comparison mode shows original vs. modified page
- [ ] Draggable slider moves smoothly at 60fps
- [ ] Labels clearly indicate which side is original/modified
- [ ] Escape key closes comparison mode
- [ ] Works on pages with scrollable content (viewport snapshot)
- [ ] Changes are not lost when entering/exiting comparison mode

---

### Feature 9: Export System

*Phase 5 — Export*
*Status: NOT STARTED*

Export the design changes in useful formats for developers to integrate into their codebase.

*Requirements:*

- *Export Panel UI:*
  - Accessible from side panel (tab or expandable section)
  - Format selector: CSS, JSON Diff, Clipboard
  - Preview pane showing the export content
  - "Copy" and "Download" buttons

- *CSS Export:*
  - Clean, well-formatted CSS file
  - Organized by selector (grouped logically)
  - Comments indicating what each section changes and why (from AI descriptions)
  - Header comment with: source URL, date, session info
  - Removes `!important` where possible (converts to higher-specificity selectors)
  - Example output:
    ```css
    /* Vibe Design Changes
     * Source: https://example.com
     * Date: 2026-03-26
     * Session: Dark mode redesign
     */

    /* Dark theme base */
    body {
      background-color: #1a1a2e;
      color: #eee;
    }

    /* Hero section emphasis */
    .hero-section h1 {
      font-size: 3.5rem;
      color: #fff;
    }
    ```

- *JSON Diff Export:*
  - Machine-readable format listing all changes
  - Includes both CSS and DOM changes
  - Structured for potential re-import or tooling integration
  - Schema:
    ```json
    {
      "version": "1.0",
      "source": "https://example.com",
      "created": "2026-03-26T12:00:00Z",
      "changes": [
        {
          "id": "c1",
          "type": "css",
          "selector": "body",
          "properties": { "background-color": "#1a1a2e" },
          "description": "Dark theme base"
        }
      ]
    }
    ```

- *Clipboard Copy:*
  - One-click copy of the CSS output
  - Toast notification: "Copied to clipboard!"

- *Backend Export Endpoint:*
  - `GET /api/export/:sessionId/:format` (format = css | json)
  - Generates the export from stored session data
  - Returns file with appropriate Content-Type and Content-Disposition headers

*Acceptance Criteria:*

- [ ] CSS export produces clean, commented, valid CSS
- [ ] JSON diff export contains all changes in structured format
- [ ] Copy to clipboard works with visual confirmation
- [ ] Download triggers browser file download
- [ ] Export panel shows a preview before downloading
- [ ] Exported CSS actually reproduces the visual changes when applied manually

---

### Feature 10: Backend with Session Management

*Phase 1 — Foundation*
*Status: NOT STARTED*

The Node.js backend that proxies AI calls, stores sessions, and serves exports. Keeps API keys off the client.

*Requirements:*

- *Server:*
  - Hono framework (lightweight, fast, TypeScript-native)
  - Port 5100
  - CORS configured for Chrome extension origin
  - Request logging (method, path, status, duration)
  - Graceful error handling with consistent error response format

- *Authentication:*
  - Simple API key auth (stored in extension settings, sent as `Authorization: Bearer <key>`)
  - Backend validates against `VIBE_API_KEY` env var
  - No user accounts in MVP — single-user, single-key

- *Database (SQLite via better-sqlite3):*
  - Tables:
    - `sessions`: id (UUID), url, title, created_at, updated_at
    - `messages`: id (UUID), session_id (FK), role (user|assistant|system), content (JSON), created_at
    - `snapshots`: id (UUID), session_id (FK), css_state (text), dom_changes (JSON), thumbnail (blob), description, created_at
  - Migrations run on startup
  - WAL mode for concurrent read performance

- *API Routes:*
  - `POST /api/chat` — main AI conversation endpoint
  - `GET /api/sessions` — list all sessions (paginated)
  - `POST /api/sessions` — create new session
  - `GET /api/sessions/:id` — get session with messages
  - `DELETE /api/sessions/:id` — delete session and associated data
  - `POST /api/snapshots` — save snapshot
  - `GET /api/snapshots/:sessionId` — list snapshots for session
  - `GET /api/export/:sessionId/:format` — export changes
  - `GET /health` — health check

- *Configuration (.env):*
  - `ANTHROPIC_API_KEY` — Claude API key
  - `VIBE_API_KEY` — extension auth key
  - `PORT` — server port (default 5100)
  - `DATABASE_PATH` — SQLite file path

*Acceptance Criteria:*

- [ ] Server starts and responds to health check
- [ ] API key authentication works (rejects invalid keys)
- [ ] Sessions are created and retrieved correctly
- [ ] Messages are stored and retrieved in order
- [ ] Snapshots are stored with thumbnails
- [ ] CORS allows requests from Chrome extension
- [ ] Database migrations run automatically on startup
- [ ] Error responses are consistent and informative

---

## Build Phases

### Phase 1: Foundation (Features 1, 2, 10)

*Goal: End-to-end skeleton — user sends message, sees AI response in side panel.*

*Steps:*

1. Scaffold the extension project:
   - Initialize `extension/` with Vite + @crxjs/vite-plugin
   - Create manifest.json (Manifest V3) with permissions: `activeTab`, `sidePanel`, `storage`, `scripting`
   - Configure TypeScript, Tailwind, React

2. Build the side panel React app (Feature 1):
   - `sidepanel/index.html` → `sidepanel/App.tsx`
   - ChatPanel, MessageBubble, MessageInput components
   - Zustand store for messages and UI state
   - Settings panel for backend URL / API key

3. Build the backend (Feature 10):
   - Initialize `backend/` with Hono, TypeScript, better-sqlite3
   - Database schema and migrations
   - Health endpoint, session CRUD, message storage
   - AI proxy endpoint (`POST /api/chat`)
   - API key middleware

4. Build the DOM reader content script (Feature 2):
   - `content/dom-reader.ts` — extraction pipeline
   - Message passing: side panel → service worker → content script → DOM snapshot back
   - Test on 5+ real websites for output quality and size

5. Wire the full loop:
   - User types message in side panel
   - Service worker requests DOM snapshot from content script
   - Service worker sends message + DOM to backend
   - Backend calls Claude, returns response
   - Side panel displays AI response

*Exit Criteria:*
- [ ] Extension loads in Chrome without errors
- [ ] Side panel opens and displays chat UI
- [ ] User can send a message and receive an AI response about the page
- [ ] DOM snapshot is under 15KB for test pages
- [ ] Backend stores sessions and messages in SQLite

---

### Phase 2: Core Engine (Features 3, 4)

*Goal: The magic loop — AI analyzes the page and applies live design changes.*

*Steps:*

1. Implement AI Design Engine (Feature 3):
   - System prompt with DOM context, design tokens, conversation history
   - Response parsing and validation against change instruction schema
   - Retry logic for malformed responses
   - Store AI responses as messages in the session

2. Implement Change Applicator (Feature 4):
   - Inject `<style id="vibe-changes">` into the page
   - CSS change application with appropriate specificity
   - DOM change application with safety checks
   - Change tracking (ordered list with undo support)
   - MutationObserver for dynamic page handling

3. Close the loop:
   - AI response → parse changes → send to content script → apply to page
   - Content script confirms application → side panel shows "Changes applied"
   - Undo button in side panel → remove last change set
   - Undo-all button → restore original page

*Exit Criteria:*
- [ ] AI returns structured change instructions (not just text)
- [ ] CSS changes are applied and visible on the page
- [ ] DOM changes work for basic operations (addClass, setText)
- [ ] Undo removes the last set of changes
- [ ] Undo-all restores the page to original state
- [ ] Changes persist through scrolling and minor DOM updates

---

### Phase 3: Polish & UX (Features 5, 6)

*Goal: The experience feels premium — smooth animations and precise targeting.*

*Steps:*

1. Implement Progress Animation (Feature 5):
   - Top progress bar (CSS only, injected via content script)
   - Element shimmer effect on changed elements
   - Wire to message lifecycle: show on send, hide on apply
   - Respect prefers-reduced-motion

2. Implement Element Targeting (Feature 6):
   - Selection mode toggle in side panel
   - Hover overlay with blue outline and tooltip
   - Click to select, persist selection
   - Send selected element context with next AI message
   - Breadcrumb path generation

3. Integration:
   - Selected element context improves AI precision
   - Progress bar provides feedback during AI processing
   - Shimmer shows the user exactly what changed

*Exit Criteria:*
- [ ] Progress bar appears and animates during AI processing
- [ ] Changed elements shimmer briefly after modification
- [ ] Element selection mode works (hover, click, outline)
- [ ] Selected element context is included in AI requests
- [ ] All animations are smooth (60fps, GPU-accelerated)

---

### Phase 4: History & Comparison (Features 7, 8)

*Goal: Design exploration — save, restore, and compare different design directions.*

*Steps:*

1. Implement Snapshot System (Feature 7):
   - Snapshot capture (CSS state + DOM changes + thumbnail)
   - Backend storage for snapshots
   - Timeline/filmstrip UI in side panel
   - State restoration on snapshot click
   - Auto-snapshot after each AI change set

2. Implement Before/After Comparison (Feature 8):
   - Screenshot capture (original and modified)
   - Full-page overlay with draggable slider
   - Smooth slider interaction
   - Escape to close

*Exit Criteria:*
- [ ] Snapshots are created with thumbnails
- [ ] Timeline displays snapshots chronologically
- [ ] Clicking a snapshot restores the page to that state
- [ ] Comparison slider shows original vs. modified
- [ ] Slider movement is smooth (60fps)

---

### Phase 5: Export (Feature 9)

*Goal: Users can take their changes out of Vibe and into their codebase.*

*Steps:*

1. Implement CSS export:
   - Aggregate all changes into a clean CSS file
   - Add comments with descriptions
   - Clean up specificity overrides where possible

2. Implement JSON diff export:
   - Structured change set with metadata
   - Machine-readable format

3. Implement clipboard copy:
   - One-click copy with toast notification

4. Build Export Panel UI:
   - Format selector, preview pane, copy/download buttons

5. Backend export endpoint:
   - Generate exports from stored session data
   - Return with appropriate headers

*Exit Criteria:*
- [ ] CSS export is valid and reproduces the changes
- [ ] JSON export contains all changes with metadata
- [ ] Copy to clipboard works
- [ ] Download triggers browser file save dialog
- [ ] Export panel previews the output

---

## File Structure

```
vibe-extension/
├── SPEC_TRACKER.md
├── extension/                    # Chrome extension
│   ├── manifest.json            # Manifest V3
│   ├── src/
│   │   ├── sidepanel/           # Side panel React app
│   │   │   ├── index.html
│   │   │   ├── index.tsx
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── MessageInput.tsx
│   │   │   │   ├── SnapshotTimeline.tsx
│   │   │   │   ├── ComparisonSlider.tsx
│   │   │   │   ├── ExportPanel.tsx
│   │   │   │   ├── ElementSelector.tsx
│   │   │   │   └── SettingsPanel.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useChat.ts
│   │   │   │   ├── useSnapshots.ts
│   │   │   │   └── useConnection.ts
│   │   │   ├── stores/
│   │   │   │   └── chatStore.ts  # Zustand
│   │   │   └── styles/
│   │   │       └── globals.css   # Tailwind
│   │   ├── content/              # Content script
│   │   │   ├── index.ts          # Main content script entry
│   │   │   ├── dom-reader.ts     # Smart DOM extraction
│   │   │   ├── change-applicator.ts  # Apply CSS/DOM changes
│   │   │   ├── element-selector.ts   # Click-to-select overlay
│   │   │   ├── animations.ts     # Progress bar + shimmer
│   │   │   ├── snapshot.ts       # Screenshot capture
│   │   │   └── comparison.ts     # Before/after slider
│   │   ├── background/
│   │   │   └── service-worker.ts # Message routing, API calls
│   │   └── shared/
│   │       ├── types.ts          # Shared TypeScript types
│   │       ├── messages.ts       # Message type definitions
│   │       └── constants.ts
│   ├── public/
│   │   ├── icons/               # Extension icons (16, 48, 128)
│   │   └── sidepanel.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts           # Vite for building extension
│   └── tailwind.config.ts
├── backend/                      # Backend API
│   ├── src/
│   │   ├── index.ts             # Entry point
│   │   ├── server.ts            # Hono app setup
│   │   ├── config.ts            # Environment config
│   │   ├── routes/
│   │   │   ├── chat.ts          # POST /api/chat
│   │   │   ├── sessions.ts      # CRUD /api/sessions
│   │   │   ├── snapshots.ts     # CRUD /api/snapshots
│   │   │   ├── export.ts        # GET /api/export/:format
│   │   │   └── health.ts        # GET /health
│   │   ├── services/
│   │   │   ├── ai.ts            # Claude Opus 4.6 integration
│   │   │   ├── dom-processor.ts # DOM simplification
│   │   │   ├── change-generator.ts # Parse AI → changes
│   │   │   └── export.ts        # Generate CSS/JSON exports
│   │   ├── db/
│   │   │   ├── index.ts         # SQLite connection
│   │   │   ├── schema.ts        # Table definitions
│   │   │   └── migrations.ts    # Auto-migrations
│   │   └── types/
│   │       ├── api.ts           # API request/response types
│   │       ├── session.ts       # Session types
│   │       └── changes.ts       # Change instruction types
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── README.md
```

---

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Chrome Side Panel API (not popup) | Popup closes when user clicks the page. Side panel stays open during interaction — essential for our workflow. | 2026-03-26 |
| 2 | Single `<style>` tag for CSS injection | Multiple style tags cause ordering/specificity issues and are harder to track. One tag with all rules is simpler and more predictable. | 2026-03-26 |
| 3 | Hono over Express for backend | Hono is lighter, faster, TypeScript-native, and has better DX for a small API. Express is overkill for an MVP proxy. | 2026-03-26 |
| 4 | SQLite over Postgres | Single-user MVP. No need for a separate database server. SQLite is zero-config and fast enough. | 2026-03-26 |
| 5 | Zustand over Redux | Minimal state management needs. Zustand has less boilerplate and is easier to reason about for a small app. | 2026-03-26 |
| 6 | @crxjs/vite-plugin for build | Purpose-built for Chrome extension development with Vite. Handles manifest, HMR in extension context, and content script bundling. | 2026-03-26 |
| 7 | API key auth (not Google sign-in) | Simpler for MVP. Avoids OAuth complexity. User sets a key in extension settings, backend validates it. Can upgrade to OAuth later. | 2026-03-26 |
| 8 | DOM snapshot under 10KB target | Claude context is expensive. A full DOM can be 500KB+. Aggressive simplification keeps costs down and responses fast. | 2026-03-26 |
| 9 | Screenshots via chrome.tabs.captureVisibleTab() | Chrome API is the most reliable way. html2canvas has rendering inconsistencies. Requires `activeTab` permission (already needed). | 2026-03-26 |
| 10 | Backend proxy for all AI calls | API keys must never be in extension code (they'd be visible in the .crx). Proxy also enables rate limiting, logging, and response caching. | 2026-03-26 |

---

## Open Questions

| # | Question | Context | Status |
|---|----------|---------|--------|
| 1 | Should we support Firefox/Safari or Chrome-only for MVP? | Side Panel API is Chrome-only. Firefox has a different sidebar API. Recommend Chrome-only for MVP. | DECIDED: Chrome only |
| 2 | How to handle SPA navigation? | When the URL changes in a SPA, should we auto-create a new session or continue the current one? | OPEN |
| 3 | Should AI see a screenshot in addition to DOM? | Vision models can reason about visual design better. Adds latency and cost. Could be opt-in. | OPEN |
| 4 | Maximum conversation length before summarization? | Long conversations = expensive context. When do we summarize older messages? Proposed: 10 message window with summary of earlier messages. | OPEN |
| 5 | How to handle responsive design changes? | User might be on desktop but want to see mobile. Should we support viewport simulation? | DEFERRED to post-MVP |
| 6 | Pricing model (if ever public)? | Per-session? Per-change? Subscription? | DEFERRED |
| 7 | Should exported CSS use the same selectors as the page or cleaner custom ones? | Page selectors might be ugly (`.css-1a2b3c`). But custom ones require mapping. | OPEN |
| 8 | How to handle pages that block content scripts? | Some sites have strict CSP. Extension can override CSP but it might break the page. | OPEN |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| DOM snapshot too large for AI context | High | Medium | Aggressive simplification pipeline, viewport-only extraction for complex pages, token counting before send |
| CSS specificity wars with existing styles | Medium | High | Use `:where()` for low-specificity defaults, `!important` as last resort, document specificity strategy |
| AI returns invalid/unparseable change instructions | Medium | Medium | Strict schema validation, retry logic (up to 2), fallback to text-only response |
| MutationObserver performance on heavy pages | Medium | Low | Debounce observations, disconnect during change application, only observe direct children of body |
| Chrome extension review rejection | High | Low | Follow all Manifest V3 best practices, document permissions justification, avoid remote code execution |
| Page breaks after DOM manipulation | High | Medium | Prefer CSS-only changes, sandbox DOM operations in try/catch, undo-all escape hatch |
| @crxjs/vite-plugin compatibility issues | Medium | Medium | Pin version, have fallback webpack config ready, test early with real extension loading |

---

## Chrome Extension Permissions Required

| Permission | Reason |
|-----------|--------|
| `activeTab` | Read DOM of the current tab, capture screenshots |
| `sidePanel` | Open and manage the side panel UI |
| `storage` | Store extension settings (backend URL, API key, preferences) |
| `scripting` | Inject content scripts dynamically if needed |

*Host permissions:*
- `http://localhost:5100/*` — backend API access (development)
- Backend production URL when deployed

---

## Database Schema

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- UUID
  url TEXT NOT NULL,             -- page URL
  title TEXT,                    -- page title
  created_at TEXT NOT NULL,      -- ISO timestamp
  updated_at TEXT NOT NULL       -- ISO timestamp
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,           -- UUID
  session_id TEXT NOT NULL,      -- FK → sessions.id
  role TEXT NOT NULL,            -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,         -- message text (user) or JSON (assistant)
  dom_snapshot TEXT,             -- DOM context sent with this message (nullable)
  created_at TEXT NOT NULL,      -- ISO timestamp
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,           -- UUID
  session_id TEXT NOT NULL,      -- FK → sessions.id
  css_state TEXT NOT NULL,       -- full CSS content at this point
  dom_changes TEXT,              -- JSON array of DOM change instructions
  thumbnail BLOB,               -- PNG thumbnail (resized)
  description TEXT,              -- human-readable description
  message_index INTEGER,         -- index in conversation that created this
  created_at TEXT NOT NULL,      -- ISO timestamp
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_snapshots_session ON snapshots(session_id, created_at);
```

---

## NPM Dependencies (Planned)

### Extension (`extension/package.json`)

| Package | Purpose |
|---------|---------|
| react, react-dom | UI framework |
| zustand | State management |
| tailwindcss, @tailwindcss/vite | Styling |
| @crxjs/vite-plugin | Chrome extension Vite plugin |
| vite | Build tool |
| typescript | Type safety |

### Backend (`backend/package.json`)

| Package | Purpose |
|---------|---------|
| hono | HTTP framework |
| @hono/node-server | Node.js adapter for Hono |
| better-sqlite3 | SQLite database |
| @anthropic-ai/sdk | Claude API client |
| uuid | UUID generation |
| zod | Request/response validation |
| dotenv | Environment variable loading |
| typescript, tsx | Type safety and dev runner |

---

*This spec tracker is the single source of truth for the Vibe project. Update it as features are completed and decisions are made.*
