import { useEffect, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { MessageType } from "../../shared/messages";

export function useConnection() {
  const { isConnected, backendUrl, setConnected } = useChatStore();

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      setConnected(response.ok);
    } catch {
      setConnected(false);
    }
  }, [backendUrl, setConnected]);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  // Also listen for connection status from service worker
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime) return;

    const listener = (message: { type: string; connected?: boolean }) => {
      if (message.type === MessageType.CONNECTION_STATUS) {
        setConnected(message.connected ?? false);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setConnected]);

  return {
    connected: isConnected,
    checkConnection,
  };
}
