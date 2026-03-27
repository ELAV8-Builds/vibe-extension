import React, { useState, useRef, useCallback } from "react";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      // Auto-resize
      const target = e.target;
      target.style.height = "auto";
      target.style.height = Math.min(target.scrollHeight, 120) + "px";
    },
    []
  );

  return (
    <div className="border-t border-vibe-border p-3 shrink-0 glass-card">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Describe your design changes..."
          rows={1}
          className="flex-1 bg-vibe-bg/80 text-vibe-text placeholder-vibe-muted rounded-xl px-3.5 py-2.5 text-sm resize-none outline-none border border-vibe-border focus:border-vibe-accent focus:shadow-[0_0_12px_var(--color-vibe-accent-glow)] transition-all duration-200 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 disabled:opacity-20 disabled:hover:from-orange-500 disabled:hover:to-amber-600 flex items-center justify-center transition-all duration-200 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-105 active:scale-95"
          title="Send message"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-white"
          >
            <path
              d="M14.5 1.5L7 9M14.5 1.5L10 14.5L7 9M14.5 1.5L1.5 6L7 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
