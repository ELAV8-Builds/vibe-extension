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
        <div className="glass-card rounded-md px-3 py-1.5 text-xs text-vibe-muted max-w-[90%]">
          {message.content}
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-in-right">
        <div className="bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm max-w-[85%] shadow-lg shadow-purple-500/10">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message
  const changeCount = message.changes?.length ?? 0;

  return (
    <div className="flex justify-start animate-slide-in">
      <div className="glass-card rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm max-w-[90%] space-y-2.5">
        {/* Description */}
        <p className="text-vibe-text leading-relaxed">{message.description || message.content}</p>

        {/* Change count badge */}
        {changeCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-vibe-accent/20 to-cyan-500/10 text-vibe-accent text-xs font-medium px-2.5 py-0.5 rounded-full border border-vibe-accent/20">
              <span className="w-1.5 h-1.5 rounded-full bg-vibe-success animate-pulse-dot" />
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
                className="text-xs text-vibe-muted font-mono bg-vibe-bg/60 rounded-lg px-2.5 py-1.5 border border-vibe-border/50"
              >
                {change.type === "css" && change.selector && (
                  <span>
                    <span className="text-cyan-400">{change.selector}</span>{" "}
                    <span className="text-vibe-accent-hover">
                      {Object.keys(change.properties || {}).join(", ")}
                    </span>
                  </span>
                )}
                {change.type === "dom" && change.action && (
                  <span>
                    <span className="text-cyan-400">{change.action}</span>
                    {change.value ? <span className="text-vibe-muted">: {change.value}</span> : ""}
                  </span>
                )}
              </div>
            ))}
            {message.changes.length > 5 && (
              <div className="text-xs text-vibe-muted pl-1">
                ... and {message.changes.length - 5} more
              </div>
            )}
          </div>
        )}

        {/* Suggestions — futuristic chips */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="text-xs glass-card hover:glass-card-glow text-vibe-accent-hover rounded-full px-3 py-1 transition-all duration-200 hover-lift"
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
