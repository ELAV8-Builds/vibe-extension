import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { MessageType } from "../../shared/messages";
import type { Message, AIDesignResponse, SelectedElement } from "../../shared/types";

export function useChat() {
  const {
    messages,
    isLoading,
    selectedElement,
    addMessage,
    setLoading,
    setSelectedElement,
  } = useChatStore();

  // Use ref for selectedElement to avoid re-subscribing the listener
  // every time the selected element changes (prevents memory leak from
  // repeated addEventListener/removeEventListener cycles).
  const selectedElementRef = useRef(selectedElement);
  selectedElementRef.current = selectedElement;

  // Listen for messages from service worker
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime) return;

    const listener = (message: { type: string; [key: string]: unknown }) => {
      if (message.type === MessageType.AI_RESPONSE) {
        const response = message.response as AIDesignResponse;
        const aiMessage: Message = {
          id: (message.messageId as string) || crypto.randomUUID(),
          role: "assistant",
          content: response.description,
          changes: response.changes,
          description: response.description,
          suggestions: response.suggestions,
          timestamp: new Date().toISOString(),
        };
        addMessage(aiMessage);
        setLoading(false);
      }

      if (message.type === MessageType.AI_ERROR) {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "system",
          content: `Error: ${message.error as string}`,
          timestamp: new Date().toISOString(),
        };
        addMessage(errorMessage);
        setLoading(false);
      }

      if (message.type === MessageType.ELEMENT_SELECTED) {
        setSelectedElement(
          message.element as SelectedElement
        );
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [addMessage, setLoading, setSelectedElement]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      addMessage(userMessage);
      setLoading(true);

      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: MessageType.SEND_MESSAGE,
          message: text.trim(),
          selectedElement: selectedElementRef.current || undefined,
        }).catch((err: Error) => {
          console.error("[Vibe] Failed to send message:", err);
          const errorMsg: Message = {
            id: crypto.randomUUID(),
            role: "system",
            content: "Failed to send message. Is the service worker running?",
            timestamp: new Date().toISOString(),
          };
          addMessage(errorMsg);
          setLoading(false);
        });
      }
    },
    [isLoading, addMessage, setLoading]
  );

  return {
    messages,
    isLoading,
    sendMessage,
  };
}
