import React, { useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

export function ChatPanel() {
  const { messages, isLoading, hasConversation, sendMessage, applyDesign } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

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
            {/* HiBrow logo with pen-nib "i" */}
            <div className="relative mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-600 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/30 animate-gradient">
                <svg
                  width="36"
                  height="24"
                  viewBox="0 0 36 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* H */}
                  <text x="0" y="18" fill="white" fontWeight="bold" fontSize="18" fontFamily="Inter, system-ui, sans-serif">H</text>
                  {/* Pen nib "i" — dot + nib body */}
                  <circle cx="16.5" cy="4.5" r="2" fill="white" />
                  <path d="M16.5 8 L18.2 17.5 L16.5 20 L14.8 17.5 Z" fill="white" />
                  {/* B */}
                  <text x="22" y="18" fill="white" fontWeight="bold" fontSize="18" fontFamily="Inter, system-ui, sans-serif">B</text>
                </svg>
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 opacity-40 blur-xl animate-energy-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-vibe-accent-hover shadow-[0_0_8px_rgba(240,148,77,0.8)] animate-orbit" />
              </div>
            </div>
            <p className="text-vibe-text font-semibold text-sm mb-1 tracking-wide">
              Welcome to HiBrow
            </p>
            <p className="text-vibe-muted text-xs leading-relaxed max-w-[240px]">
              Tell me about the design you're envisioning. We'll discuss ideas, then make it happen.
            </p>
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
            <button
              onClick={() => sendMessage("Look at my site and give me ideas on how to make it better")}
              className="mt-4 w-full max-w-[260px] py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-600 to-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 animate-gradient"
            >
              Give me ideas to improve my site
            </button>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSuggestionClick={sendMessage}
          />
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="glass-card-glow rounded-xl px-4 py-3 flex items-center gap-3">
              <svg
                className="designing-pen shrink-0"
                width="36"
                height="36"
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="pen-body-grad" x1="8" y1="28" x2="28" y2="8" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#e8732a" />
                    <stop offset="60%" stopColor="#f0944d" />
                    <stop offset="100%" stopColor="#e8732a" />
                  </linearGradient>
                  <linearGradient id="pen-ink-grad" x1="6" y1="32" x2="18" y2="26" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#e8732a" stopOpacity="0" />
                    <stop offset="40%" stopColor="#e8732a" />
                    <stop offset="100%" stopColor="#f0944d" />
                  </linearGradient>
                </defs>
                {/* Pen barrel */}
                <path
                  d="M24 6 L30 12 L14 28 L8 22 Z"
                  fill="url(#pen-body-grad)"
                  opacity="0.9"
                />
                {/* Pen nib */}
                <path
                  d="M14 28 L8 22 L5.5 30.5 Z"
                  fill="#e8732a"
                />
                {/* Nib tip highlight */}
                <circle cx="6" cy="30" r="1" fill="#f0944d" opacity="0.9" />
                {/* Pen top edge */}
                <path
                  d="M24 6 L30 12 L28.5 13.5 L22.5 7.5 Z"
                  fill="#5a3a1a"
                  opacity="0.5"
                />
                {/* Ink stroke that draws and redraws */}
                <path
                  className="designing-pen-ink"
                  d="M5 31 Q3 33 6 34 Q10 34 16 30"
                  stroke="url(#pen-ink-grad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-vibe-accent neon-text">
                  Designing...
                </span>
                <div className="flex gap-1">
                  <span className="w-8 h-1 rounded-full bg-vibe-accent/30 overflow-hidden">
                    <span className="block w-full h-full bg-gradient-to-r from-orange-500 to-blue-400 animate-gradient rounded-full" />
                  </span>
                  <span className="w-5 h-1 rounded-full bg-vibe-accent/20 overflow-hidden">
                    <span className="block w-full h-full bg-gradient-to-r from-blue-400 to-orange-500 animate-gradient rounded-full" style={{ animationDelay: "0.3s" }} />
                  </span>
                  <span className="w-3 h-1 rounded-full bg-vibe-accent/10 overflow-hidden">
                    <span className="block w-full h-full bg-gradient-to-r from-orange-500 to-blue-400 animate-gradient rounded-full" style={{ animationDelay: "0.6s" }} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Make it happen button */}
      {hasConversation && !isLoading && (
        <div className="px-3 pt-2 shrink-0">
          <button
            onClick={applyDesign}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 animate-gradient"
          >
            Make it happen
          </button>
        </div>
      )}

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
