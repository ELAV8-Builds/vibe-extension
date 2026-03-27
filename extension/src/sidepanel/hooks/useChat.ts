import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { MessageType } from "../../shared/messages";
import type { Message, AIDesignResponse, SelectedElement } from "../../shared/types";

function buildConversationHistory(
  messages: Message[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

export function useChat() {
  const {
    messages,
    isLoading,
    selectedElement,
    addMessage,
    setLoading,
    setSelectedElement,
  } = useChatStore();

  const selectedElementRef = useRef(selectedElement);
  selectedElementRef.current = selectedElement;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

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
        const history = buildConversationHistory(messagesRef.current);
        chrome.runtime.sendMessage({
          type: MessageType.SEND_MESSAGE,
          message: text.trim(),
          selectedElement: selectedElementRef.current || undefined,
          conversationHistory: history,
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

  const applyDesign = useCallback(() => {
    if (isLoading) return;

    const history = buildConversationHistory(messagesRef.current);
    if (history.length === 0) return;

    setLoading(true);

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: MessageType.APPLY_DESIGN,
        conversationHistory: history,
        selectedElement: selectedElementRef.current || undefined,
      }).catch((err: Error) => {
        console.error("[Vibe] Failed to apply design:", err);
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "system",
          content: "Failed to apply design. Is the service worker running?",
          timestamp: new Date().toISOString(),
        };
        addMessage(errorMsg);
        setLoading(false);
      });
    }
  }, [isLoading, addMessage, setLoading]);

  const hasConversation = messages.some((m) => m.role === "assistant");

  return {
    messages,
    isLoading,
    hasConversation,
    sendMessage,
    applyDesign,
  };
}
