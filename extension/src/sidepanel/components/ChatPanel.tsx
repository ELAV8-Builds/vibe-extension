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
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
            {/* Futuristic orb logo */}
            <div className="relative mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-purple-500/30 animate-gradient">
                V
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 opacity-40 blur-xl animate-energy-pulse" />
              {/* Orbiting dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-orbit" />
              </div>
            </div>
            <p className="text-vibe-text font-semibold text-sm mb-1 tracking-wide">
              Welcome to VIBE
            </p>
            <p className="text-vibe-muted text-xs leading-relaxed max-w-[240px]">
              Describe how you want to redesign this page. I'll make it happen in real-time.
            </p>
            {/* Quick action chips */}
            <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
              {["Dark mode", "Modern look", "Bigger fonts", "New colors"].map((hint) => (
                <button
                  key={hint}
                  onClick={() => sendMessage(hint)}
                  className="text-[11px] glass-card hover:glass-card-glow text-vibe-muted hover:text-vibe-accent px-2.5 py-1 rounded-full transition-all duration-200 hover-lift"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSuggestionClick={sendMessage}
          />
        ))}

        {/* Futuristic building/thinking indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="glass-card-glow rounded-xl px-4 py-3 flex items-center gap-3">
              {/* Spinning orb */}
              <div className="loading-orb shrink-0">
                <div className="absolute inset-[10px] rounded-full bg-vibe-accent/20" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-vibe-accent neon-text">
                  Designing...
                </span>
                <div className="flex gap-1">
                  <span className="w-8 h-1 rounded-full bg-vibe-accent/30 overflow-hidden">
                    <span className="block w-full h-full bg-gradient-to-r from-purple-500 to-cyan-400 animate-gradient rounded-full" />
                  </span>
                  <span className="w-5 h-1 rounded-full bg-vibe-accent/20 overflow-hidden">
                    <span className="block w-full h-full bg-gradient-to-r from-cyan-400 to-purple-500 animate-gradient rounded-full" style={{ animationDelay: "0.3s" }} />
                  </span>
                  <span className="w-3 h-1 rounded-full bg-vibe-accent/10 overflow-hidden">
                    <span className="block w-full h-full bg-gradient-to-r from-purple-500 to-cyan-400 animate-gradient rounded-full" style={{ animationDelay: "0.6s" }} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
