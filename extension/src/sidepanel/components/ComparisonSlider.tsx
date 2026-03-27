import React, { useCallback } from "react";
import { MessageType } from "../../shared/messages";

export function ComparisonSlider() {
  const [active, setActive] = React.useState(false);

  const toggleComparison = useCallback(() => {
    const newState = !active;
    setActive(newState);

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: MessageType.TOGGLE_COMPARISON,
        enabled: newState,
      }).catch(() => {
        // Service worker may not be reachable; revert state
        setActive(!newState);
      });
    }
  }, [active]);

  return (
    <button
      onClick={toggleComparison}
      className={`text-xs rounded-md px-2.5 py-1 transition-colors duration-150 ${
        active
          ? "bg-vibe-accent text-white"
          : "bg-vibe-card text-vibe-muted hover:text-vibe-text border border-vibe-border"
      }`}
      title="Toggle before/after comparison"
    >
      {active ? "Hide Comparison" : "Compare"}
    </button>
  );
}
