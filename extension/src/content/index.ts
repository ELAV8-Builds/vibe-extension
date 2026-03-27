/// Content script entry point
/// Routes messages from the service worker to appropriate handlers.

import { MessageType } from "../shared/messages";
import type { ChangeInstruction } from "../shared/types";
import { extractDOMSnapshot } from "./dom-reader";
import { applyChanges, undoLast, undoAll, getAppliedChanges, getCssState } from "./change-applicator";
import { enableSelector, disableSelector } from "./element-selector";
import { showProgress, hideProgress, shimmerElements } from "./animations";
import { captureSnapshotState, restoreSnapshotState } from "./snapshot";
import { showComparison, hideComparison } from "./comparison";

// ─── Message Listener ───

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; [key: string]: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    switch (message.type) {
      case MessageType.REQUEST_DOM_SNAPSHOT: {
        const snapshot = extractDOMSnapshot();
        sendResponse({ type: MessageType.DOM_SNAPSHOT_RESULT, snapshot });
        break;
      }

      case MessageType.APPLY_CHANGES: {
        const changes = message.changes as ChangeInstruction[];
        const result = applyChanges(changes);
        sendResponse({ type: MessageType.CHANGES_APPLIED, ...result });

        // Shimmer changed elements
        const selectors = changes
          .filter((c) => c.type === "css" && c.selector)
          .map((c) => c.selector as string);
        if (selectors.length > 0) {
          shimmerElements(selectors);
        }
        break;
      }

      case MessageType.ENABLE_ELEMENT_SELECTOR: {
        enableSelector();
        sendResponse({ success: true });
        break;
      }

      case MessageType.DISABLE_ELEMENT_SELECTOR: {
        disableSelector();
        sendResponse({ success: true });
        break;
      }

      case MessageType.SHOW_PROGRESS: {
        showProgress();
        sendResponse({ success: true });
        break;
      }

      case MessageType.HIDE_PROGRESS: {
        hideProgress();
        sendResponse({ success: true });
        break;
      }

      case MessageType.SHIMMER_ELEMENTS: {
        const selectors = message.selectors as string[];
        shimmerElements(selectors);
        sendResponse({ success: true });
        break;
      }

      case MessageType.CAPTURE_SNAPSHOT_STATE: {
        const state = captureSnapshotState();
        sendResponse({
          type: MessageType.SNAPSHOT_STATE_CAPTURED,
          ...state,
        });
        break;
      }

      case MessageType.RESTORE_SNAPSHOT_STATE: {
        const cssState = message.cssState as string;
        const domChanges = message.domChanges as ChangeInstruction[];
        restoreSnapshotState(cssState, domChanges);
        sendResponse({ success: true });
        break;
      }

      case MessageType.SHOW_COMPARISON: {
        const original = message.originalScreenshot as string;
        const modified = message.modifiedScreenshot as string;
        showComparison(original, modified);
        sendResponse({ success: true });
        break;
      }

      case MessageType.HIDE_COMPARISON: {
        hideComparison();
        sendResponse({ success: true });
        break;
      }

      case MessageType.UNDO_LAST: {
        undoLast();
        sendResponse({ success: true });
        break;
      }

      case MessageType.UNDO_ALL: {
        undoAll();
        sendResponse({ success: true });
        break;
      }

      case MessageType.GET_APPLIED_CHANGES: {
        const applied = getAppliedChanges();
        sendResponse({ changes: applied, cssState: getCssState() });
        break;
      }

      default:
        break;
    }

    // Return true to indicate we might send an async response
    return true;
  }
);

// Signal that the content script is loaded
console.log("[Vibe] Content script loaded");
