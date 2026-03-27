import { useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { MessageType } from "../../shared/messages";
import type { Snapshot } from "../../shared/types";

export function useSnapshots() {
  const { snapshots, addSnapshot, removeSnapshot, setSnapshots } =
    useChatStore();

  const saveSnapshot = useCallback(
    (description?: string) => {
      if (typeof chrome === "undefined" || !chrome.runtime) return;

      chrome.runtime.sendMessage(
        {
          type: MessageType.SAVE_SNAPSHOT,
          description,
        },
        (response: { snapshot?: Snapshot; error?: string } | undefined) => {
          if (chrome.runtime.lastError) {
            console.error("[Vibe] Save snapshot error:", chrome.runtime.lastError.message);
            return;
          }
          if (response?.snapshot) {
            addSnapshot(response.snapshot);
          }
        }
      );
    },
    [addSnapshot]
  );

  const restoreSnapshot = useCallback(
    (snapshot: Snapshot) => {
      if (typeof chrome === "undefined" || !chrome.runtime) return;

      chrome.runtime.sendMessage({
        type: MessageType.RESTORE_SNAPSHOT,
        snapshot,
      }).catch((err: Error) => {
        console.error("[Vibe] Restore snapshot error:", err);
      });
    },
    []
  );

  const deleteSnapshot = useCallback(
    (id: string) => {
      removeSnapshot(id);
    },
    [removeSnapshot]
  );

  return {
    snapshots,
    saveSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    addSnapshot,
    setSnapshots,
  };
}
