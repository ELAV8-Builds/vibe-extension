import React from "react";
import type { Message } from "../../shared/types";

interface MessageBubbleProps {
  message: Message;
  onSuggestionClick?: (text: string) => void;
}

export function MessageBubble({ message, onSuggestionClick }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center animate-fade-in">
        <div className="bg-vibe-card/50 rounded-md px-3 py-1.5 text-xs text-vibe-muted max-w-[90%]">
          {message.content}
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="bg-vibe-user text-white rounded-lg rounded-br-sm px-3 py-2 text-sm max-w-[85%]">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message
  const changeCount = message.changes?.length ?? 0;

  return (
    <div className="flex justify-start animate-slide-in">
      <div className="bg-vibe-card rounded-lg rounded-bl-sm px-3 py-2 text-sm max-w-[90%] space-y-2">
        {/* Description */}
        <p className="text-vibe-text leading-relaxed">{message.description || message.content}</p>

        {/* Change count badge */}
        {changeCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 bg-vibe-accent/20 text-vibe-accent text-xs font-medium px-2 py-0.5 rounded-full">
              {changeCount} change{changeCount !== 1 ? "s" : ""} applied
            </span>
          </div>
        )}

        {/* Changes list */}
        {message.changes && message.changes.length > 0 && (
          <div className="space-y-1">
            {message.changes.slice(0, 5).map((change, i) => (
              <div
                key={i}
                className="text-xs text-vibe-muted font-mono bg-vibe-bg/50 rounded px-2 py-1"
              >
                {change.type === "css" && change.selector && (
                  <span>
                    {change.selector}{" "}
                    <span className="text-vibe-accent">
                      {Object.keys(change.properties || {}).join(", ")}
                    </span>
                  </span>
                )}
                {change.type === "dom" && change.action && (
                  <span>
                    {change.action}
                    {change.value ? `: ${change.value}` : ""}
                  </span>
                )}
              </div>
            ))}
            {message.changes.length > 5 && (
              <div className="text-xs text-vibe-muted">
                ... and {message.changes.length - 5} more
              </div>
            )}
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="text-xs bg-vibe-accent/10 hover:bg-vibe-accent/20 text-vibe-accent-hover border border-vibe-accent/30 rounded-full px-2.5 py-1 transition-colors duration-150"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
