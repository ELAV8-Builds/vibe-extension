import React, { useState, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { MessageType } from "../../shared/messages";

export function ElementSelector() {
  const [active, setActive] = useState(false);
  const { selectedElement, setSelectedElement } = useChatStore();

  const toggleSelector = useCallback(() => {
    const newState = !active;
    setActive(newState);

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: MessageType.TOGGLE_ELEMENT_SELECTOR,
        enabled: newState,
      }).catch(() => {
        // Service worker may not be reachable; revert state
        setActive(!newState);
      });
    }
  }, [active]);

  const clearSelection = useCallback(() => {
    setSelectedElement(null);
    setActive(false);

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: MessageType.TOGGLE_ELEMENT_SELECTOR,
        enabled: false,
      }).catch(() => {
        // Ignore -- best effort
      });
    }
  }, [setSelectedElement]);

  return (
    <div className="flex items-center gap-2">
      {selectedElement && (
        <button
          onClick={clearSelection}
          className="text-[10px] text-vibe-muted hover:text-vibe-error transition-colors"
          title="Clear selection"
        >
          Clear
        </button>
      )}
      <button
        onClick={toggleSelector}
        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150 ${
          active
            ? "bg-vibe-accent text-white"
            : "bg-vibe-card text-vibe-muted hover:text-vibe-text border border-vibe-border"
        }`}
        title={active ? "Disable element selector" : "Select element"}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle
            cx="7"
            cy="7"
            r="5.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="7"
            y1="1"
            x2="7"
            y2="4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="7"
            y1="10"
            x2="7"
            y2="13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="1"
            y1="7"
            x2="4"
            y2="7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="7"
            x2="13"
            y2="7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
