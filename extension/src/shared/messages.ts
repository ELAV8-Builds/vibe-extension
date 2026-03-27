import type {
  ChangeInstruction,
  DOMSnapshot,
  SelectedElement,
  Snapshot,
  AIDesignResponse,
  ExtensionSettings,
} from "./types";

// ─── Message Types ───

export enum MessageType {
  // Side panel → Service worker
  SEND_MESSAGE = "SEND_MESSAGE",
  APPLY_DESIGN = "APPLY_DESIGN",
  GET_DOM_SNAPSHOT = "GET_DOM_SNAPSHOT",
  TOGGLE_ELEMENT_SELECTOR = "TOGGLE_ELEMENT_SELECTOR",
  CAPTURE_SCREENSHOT = "CAPTURE_SCREENSHOT",
  SAVE_SNAPSHOT = "SAVE_SNAPSHOT",
  RESTORE_SNAPSHOT = "RESTORE_SNAPSHOT",
  TOGGLE_COMPARISON = "TOGGLE_COMPARISON",
  EXPORT_CHANGES = "EXPORT_CHANGES",
  UPDATE_SETTINGS = "UPDATE_SETTINGS",
  CHECK_CONNECTION = "CHECK_CONNECTION",

  // Service worker → Content script
  APPLY_CHANGES = "APPLY_CHANGES",
  REQUEST_DOM_SNAPSHOT = "REQUEST_DOM_SNAPSHOT",
  ENABLE_ELEMENT_SELECTOR = "ENABLE_ELEMENT_SELECTOR",
  DISABLE_ELEMENT_SELECTOR = "DISABLE_ELEMENT_SELECTOR",
  SHOW_PROGRESS = "SHOW_PROGRESS",
  HIDE_PROGRESS = "HIDE_PROGRESS",
  SHIMMER_ELEMENTS = "SHIMMER_ELEMENTS",
  CAPTURE_SNAPSHOT_STATE = "CAPTURE_SNAPSHOT_STATE",
  RESTORE_SNAPSHOT_STATE = "RESTORE_SNAPSHOT_STATE",
  SHOW_COMPARISON = "SHOW_COMPARISON",
  HIDE_COMPARISON = "HIDE_COMPARISON",
  UNDO_LAST = "UNDO_LAST",
  UNDO_ALL = "UNDO_ALL",
  GET_APPLIED_CHANGES = "GET_APPLIED_CHANGES",
  GET_MODIFIED_HTML = "GET_MODIFIED_HTML",

  // Content script → Service worker / Side panel
  EXECUTE_SCRIPT = "EXECUTE_SCRIPT",
  DOM_SNAPSHOT_RESULT = "DOM_SNAPSHOT_RESULT",
  ELEMENT_SELECTED = "ELEMENT_SELECTED",
  CHANGES_APPLIED = "CHANGES_APPLIED",
  SNAPSHOT_STATE_CAPTURED = "SNAPSHOT_STATE_CAPTURED",
  SCREENSHOT_RESULT = "SCREENSHOT_RESULT",

  // Service worker → Side panel
  AI_RESPONSE = "AI_RESPONSE",
  AI_ERROR = "AI_ERROR",
  CONNECTION_STATUS = "CONNECTION_STATUS",
}

// ─── Message Payloads ───

export interface SendMessagePayload {
  type: MessageType.SEND_MESSAGE;
  message: string;
  selectedElement?: SelectedElement;
}

export interface ApplyDesignPayload {
  type: MessageType.APPLY_DESIGN;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  selectedElement?: SelectedElement;
}

export interface GetDomSnapshotPayload {
  type: MessageType.GET_DOM_SNAPSHOT;
}

export interface ApplyChangesPayload {
  type: MessageType.APPLY_CHANGES;
  changes: ChangeInstruction[];
}

export interface DomSnapshotResultPayload {
  type: MessageType.DOM_SNAPSHOT_RESULT;
  snapshot: DOMSnapshot;
}

export interface ElementSelectedPayload {
  type: MessageType.ELEMENT_SELECTED;
  element: SelectedElement;
}

export interface ChangesAppliedPayload {
  type: MessageType.CHANGES_APPLIED;
  appliedCount: number;
  errors: string[];
}

export interface AIResponsePayload {
  type: MessageType.AI_RESPONSE;
  response: AIDesignResponse;
  messageId: string;
}

export interface AIErrorPayload {
  type: MessageType.AI_ERROR;
  error: string;
}

export interface ToggleElementSelectorPayload {
  type: MessageType.TOGGLE_ELEMENT_SELECTOR;
  enabled: boolean;
}

export interface CaptureScreenshotPayload {
  type: MessageType.CAPTURE_SCREENSHOT;
}

export interface ScreenshotResultPayload {
  type: MessageType.SCREENSHOT_RESULT;
  dataUrl: string;
}

export interface ShowProgressPayload {
  type: MessageType.SHOW_PROGRESS;
}

export interface HideProgressPayload {
  type: MessageType.HIDE_PROGRESS;
}

export interface ShimmerElementsPayload {
  type: MessageType.SHIMMER_ELEMENTS;
  selectors: string[];
}

export interface SaveSnapshotPayload {
  type: MessageType.SAVE_SNAPSHOT;
  description?: string;
}

export interface RestoreSnapshotPayload {
  type: MessageType.RESTORE_SNAPSHOT;
  snapshot: Snapshot;
}

export interface CaptureSnapshotStatePayload {
  type: MessageType.CAPTURE_SNAPSHOT_STATE;
}

export interface RestoreSnapshotStatePayload {
  type: MessageType.RESTORE_SNAPSHOT_STATE;
  cssState: string;
  domChanges: ChangeInstruction[];
}

export interface SnapshotStateCapturedPayload {
  type: MessageType.SNAPSHOT_STATE_CAPTURED;
  cssState: string;
  domChanges: ChangeInstruction[];
}

export interface ToggleComparisonPayload {
  type: MessageType.TOGGLE_COMPARISON;
  enabled: boolean;
}

export interface ShowComparisonPayload {
  type: MessageType.SHOW_COMPARISON;
  originalScreenshot: string;
  modifiedScreenshot: string;
}

export interface ExportChangesPayload {
  type: MessageType.EXPORT_CHANGES;
  format: "css" | "json" | "html";
}

export interface GetModifiedHtmlPayload {
  type: MessageType.GET_MODIFIED_HTML;
  selector?: string;
}

export interface UpdateSettingsPayload {
  type: MessageType.UPDATE_SETTINGS;
  settings: ExtensionSettings;
}

export interface CheckConnectionPayload {
  type: MessageType.CHECK_CONNECTION;
}

export interface ConnectionStatusPayload {
  type: MessageType.CONNECTION_STATUS;
  connected: boolean;
}

export interface UndoLastPayload {
  type: MessageType.UNDO_LAST;
}

export interface UndoAllPayload {
  type: MessageType.UNDO_ALL;
}

export interface RequestDomSnapshotPayload {
  type: MessageType.REQUEST_DOM_SNAPSHOT;
}

export interface EnableElementSelectorPayload {
  type: MessageType.ENABLE_ELEMENT_SELECTOR;
}

export interface DisableElementSelectorPayload {
  type: MessageType.DISABLE_ELEMENT_SELECTOR;
}

export interface GetAppliedChangesPayload {
  type: MessageType.GET_APPLIED_CHANGES;
}

export interface HideComparisonPayload {
  type: MessageType.HIDE_COMPARISON;
}

// ─── Union Type ───

export type ExtensionMessage =
  | SendMessagePayload
  | ApplyDesignPayload
  | GetDomSnapshotPayload
  | ApplyChangesPayload
  | DomSnapshotResultPayload
  | ElementSelectedPayload
  | ChangesAppliedPayload
  | AIResponsePayload
  | AIErrorPayload
  | ToggleElementSelectorPayload
  | CaptureScreenshotPayload
  | ScreenshotResultPayload
  | ShowProgressPayload
  | HideProgressPayload
  | ShimmerElementsPayload
  | SaveSnapshotPayload
  | RestoreSnapshotPayload
  | CaptureSnapshotStatePayload
  | RestoreSnapshotStatePayload
  | SnapshotStateCapturedPayload
  | ToggleComparisonPayload
  | ShowComparisonPayload
  | ExportChangesPayload
  | UpdateSettingsPayload
  | CheckConnectionPayload
  | ConnectionStatusPayload
  | UndoLastPayload
  | UndoAllPayload
  | RequestDomSnapshotPayload
  | EnableElementSelectorPayload
  | DisableElementSelectorPayload
  | GetAppliedChangesPayload
  | GetModifiedHtmlPayload
  | HideComparisonPayload;
