import React, { useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

export function ChatPanel() {
  const { messages, isLoading, sendMessage } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold mb-3">
              V
            </div>
            <p className="text-vibe-muted text-sm mb-1">
              Welcome to Vibe
            </p>
            <p className="text-vibe-muted text-xs">
              Describe the design changes you want to make to this page.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSuggestionClick={sendMessage}
          />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-2 animate-fade-in">
            <div className="bg-vibe-card rounded-lg px-3 py-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-vibe-accent rounded-full animate-pulse-dot" />
              <span
                className="w-1.5 h-1.5 bg-vibe-accent rounded-full animate-pulse-dot"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="w-1.5 h-1.5 bg-vibe-accent rounded-full animate-pulse-dot"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
