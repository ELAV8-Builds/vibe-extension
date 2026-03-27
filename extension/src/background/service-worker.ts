/// Service worker — message router between side panel and content scripts.

import { MessageType } from "../shared/messages";
import type {
  ChangeInstruction,
  DOMSnapshot,
  SelectedElement,
  Snapshot,
  AIDesignResponse,
  ExtensionSettings,
} from "../shared/types";
import {
  DEFAULT_BACKEND_URL,
  DEFAULT_API_KEY,
  STORAGE_KEY_SETTINGS,
} from "../shared/constants";

// ─── Settings State ───

let backendUrl = DEFAULT_BACKEND_URL;
let apiKey = DEFAULT_API_KEY;

// Load settings from storage on startup
chrome.storage.local.get(STORAGE_KEY_SETTINGS, (result) => {
  const settings = result[STORAGE_KEY_SETTINGS] as
    | ExtensionSettings
    | undefined;
  if (settings) {
    backendUrl = settings.backendUrl || DEFAULT_BACKEND_URL;
    apiKey = settings.apiKey || DEFAULT_API_KEY;
  }
});

// ─── Side Panel Setup ───

// Open side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ─── Helper: Get Active Tab ID ───

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab?.id;
}

// ─── Helper: Send to Content Script ───

async function sendToContentScript(
  tabId: number,
  message: Record<string, unknown>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ─── Helper: Send to Side Panel ───

function sendToSidePanel(message: Record<string, unknown>): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel might not be open; ignore errors
  });
}

// ─── Backend API Call ───

async function sendToBackend(
  message: string,
  domSnapshot: DOMSnapshot,
  selectedElement?: SelectedElement
): Promise<AIDesignResponse> {
  const response = await fetch(`${backendUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      message,
      domSnapshot,
      selectedElement,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as AIDesignResponse;
  return data;
}

// ─── Screenshot Capture ───

async function captureScreenshot(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

// ─── Message Handler ───

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; [key: string]: unknown },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    // Handle async messages
    handleMessage(message, sender).then(sendResponse).catch((err) => {
      console.error("[Vibe SW] Error:", err);
      sendResponse({ error: (err as Error).message });
    });

    // Return true to indicate async response
    return true;
  }
);

async function handleMessage(
  message: { type: string; [key: string]: unknown },
  _sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    // ─── Side Panel → Service Worker ───

    case MessageType.SEND_MESSAGE: {
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("No active tab found");

      // Show progress bar
      await sendToContentScript(tabId, {
        type: MessageType.SHOW_PROGRESS,
      }).catch(() => {});

      try {
        // Get DOM snapshot from content script
        const snapshotResult = (await sendToContentScript(tabId, {
          type: MessageType.REQUEST_DOM_SNAPSHOT,
        })) as { snapshot: DOMSnapshot };

        // Send to backend
        const selectedElement = message.selectedElement as
          | SelectedElement
          | undefined;
        const aiResponse = await sendToBackend(
          message.message as string,
          snapshotResult.snapshot,
          selectedElement
        );

        // Apply changes to the page
        if (aiResponse.changes && aiResponse.changes.length > 0) {
          await sendToContentScript(tabId, {
            type: MessageType.APPLY_CHANGES,
            changes: aiResponse.changes,
          });

          // Shimmer changed elements
          const selectors = aiResponse.changes
            .filter((c) => c.type === "css" && c.selector)
            .map((c) => c.selector);
          if (selectors.length > 0) {
            await sendToContentScript(tabId, {
              type: MessageType.SHIMMER_ELEMENTS,
              selectors,
            }).catch(() => {});
          }
        }

        // Hide progress bar
        await sendToContentScript(tabId, {
          type: MessageType.HIDE_PROGRESS,
        }).catch(() => {});

        // Send response to side panel
        sendToSidePanel({
          type: MessageType.AI_RESPONSE,
          response: aiResponse,
          messageId: crypto.randomUUID(),
        });

        return { success: true };
      } catch (err) {
        // Hide progress bar on error
        await sendToContentScript(tabId, {
          type: MessageType.HIDE_PROGRESS,
        }).catch(() => {});

        sendToSidePanel({
          type: MessageType.AI_ERROR,
          error: (err as Error).message,
        });

        return { error: (err as Error).message };
      }
    }

    case MessageType.GET_DOM_SNAPSHOT: {
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("No active tab found");
      return sendToContentScript(tabId, {
        type: MessageType.REQUEST_DOM_SNAPSHOT,
      });
    }

    case MessageType.TOGGLE_ELEMENT_SELECTOR: {
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("No active tab found");
      const enabled = message.enabled as boolean;
      return sendToContentScript(tabId, {
        type: enabled
          ? MessageType.ENABLE_ELEMENT_SELECTOR
          : MessageType.DISABLE_ELEMENT_SELECTOR,
      });
    }

    case MessageType.CAPTURE_SCREENSHOT: {
      const dataUrl = await captureScreenshot();
      return { type: MessageType.SCREENSHOT_RESULT, dataUrl };
    }

    case MessageType.SAVE_SNAPSHOT: {
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("No active tab found");

      // Capture current state from content script
      const state = (await sendToContentScript(tabId, {
        type: MessageType.CAPTURE_SNAPSHOT_STATE,
      })) as { cssState: string; domChanges: ChangeInstruction[] };

      // Capture screenshot
      const screenshot = await captureScreenshot();

      const snapshot: Snapshot = {
        id: crypto.randomUUID(),
        sessionId: "",
        cssState: state.cssState,
        domChanges: state.domChanges,
        thumbnail: screenshot,
        description:
          (message.description as string) || "Manual snapshot",
        createdAt: new Date().toISOString(),
      };

      return { snapshot };
    }

    case MessageType.RESTORE_SNAPSHOT: {
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("No active tab found");
      const snapshot = message.snapshot as Snapshot;
      return sendToContentScript(tabId, {
        type: MessageType.RESTORE_SNAPSHOT_STATE,
        cssState: snapshot.cssState,
        domChanges: snapshot.domChanges,
      });
    }

    case MessageType.TOGGLE_COMPARISON: {
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("No active tab found");
      const enabled = message.enabled as boolean;

      if (enabled) {
        // Capture modified screenshot first
        const modifiedScreenshot = await captureScreenshot();

        // Capture current state so we can restore it
        const savedState = (await sendToContentScript(tabId, {
          type: MessageType.CAPTURE_SNAPSHOT_STATE,
        })) as { cssState: string; domChanges: ChangeInstruction[] };

        // Remove changes temporarily
        await sendToContentScript(tabId, {
          type: MessageType.UNDO_ALL,
        });

        // Small delay for render
        await new Promise((r) => setTimeout(r, 100));

        // Capture original screenshot
        const originalScreenshot = await captureScreenshot();

        // Restore changes from saved state
        await sendToContentScript(tabId, {
          type: MessageType.RESTORE_SNAPSHOT_STATE,
          cssState: savedState.cssState,
          domChanges: savedState.domChanges,
        });

        // Small delay for restoration to take effect
        await new Promise((r) => setTimeout(r, 50));

        // Show comparison overlay
        await sendToContentScript(tabId, {
          type: MessageType.SHOW_COMPARISON,
          originalScreenshot,
          modifiedScreenshot,
        });
      } else {
        await sendToContentScript(tabId, {
          type: MessageType.HIDE_COMPARISON,
        });
      }

      return { success: true };
    }

    case MessageType.EXPORT_CHANGES: {
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("No active tab found");
      const format = message.format as string;

      const state = (await sendToContentScript(tabId, {
        type: MessageType.GET_APPLIED_CHANGES,
      })) as { changes: unknown[]; cssState: string };

      if (format === "css") {
        return { content: state.cssState };
      } else {
        return {
          content: JSON.stringify(
            { version: "1.0", changes: state.changes },
            null,
            2
          ),
        };
      }
    }

    case MessageType.UPDATE_SETTINGS: {
      const settings = message.settings as ExtensionSettings;
      backendUrl = settings.backendUrl || DEFAULT_BACKEND_URL;
      apiKey = settings.apiKey || DEFAULT_API_KEY;
      return { success: true };
    }

    case MessageType.CHECK_CONNECTION: {
      try {
        const response = await fetch(`${backendUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        return { connected: response.ok };
      } catch {
        return { connected: false };
      }
    }

    // ─── Content Script → Service Worker ───

    case MessageType.ELEMENT_SELECTED: {
      // Forward to side panel
      sendToSidePanel({
        type: MessageType.ELEMENT_SELECTED,
        element: message.element,
      });
      return { success: true };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}
