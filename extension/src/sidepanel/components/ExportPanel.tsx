import React, { useState, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { MessageType } from "../../shared/messages";

type ExportFormat = "css" | "json" | "html";

export function ExportPanel() {
  const { exportContent, exportFormat, setExportFormat, setExportContent } =
    useChatStore();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFormatChange = useCallback(
    (format: ExportFormat) => {
      setExportFormat(format);
      setLoading(true);

      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          {
            type: MessageType.EXPORT_CHANGES,
            format,
          },
          (response: { content?: string; error?: string } | undefined) => {
            setLoading(false);
            if (chrome.runtime.lastError) {
              console.error("[Vibe] Export error:", chrome.runtime.lastError.message);
              return;
            }
            if (response?.content) {
              setExportContent(response.content);
            }
          }
        );
      } else {
        setLoading(false);
      }
    },
    [setExportFormat, setExportContent]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = exportContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [exportContent]);

  const handleDownload = useCallback(() => {
    const extMap: Record<string, string> = { css: "css", json: "json", html: "html" };
    const mimeMap: Record<string, string> = { css: "text/css", json: "application/json", html: "text/html" };
    const ext = extMap[exportFormat] || "txt";
    const mimeType = mimeMap[exportFormat] || "text/plain";
    const blob = new Blob([exportContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vibe-changes.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportContent, exportFormat]);

  return (
    <div className="flex flex-col h-full">
      {/* Format selector */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-vibe-border shrink-0">
        <span className="text-xs text-vibe-muted">Format:</span>
        {(["css", "json", "html"] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => handleFormatChange(fmt)}
            className={`text-xs rounded-md px-2.5 py-1 transition-colors duration-150 ${
              exportFormat === fmt
                ? "bg-vibe-accent text-white"
                : "bg-vibe-card text-vibe-muted hover:text-vibe-text border border-vibe-border"
            }`}
          >
            {fmt.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="flex items-center gap-1.5 justify-center mb-2">
                <span className="w-1.5 h-1.5 bg-vibe-accent rounded-full animate-pulse-dot" />
                <span className="w-1.5 h-1.5 bg-vibe-accent rounded-full animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
                <span className="w-1.5 h-1.5 bg-vibe-accent rounded-full animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
              </div>
              <p className="text-vibe-muted text-xs">Loading export...</p>
            </div>
          </div>
        ) : exportContent ? (
          <pre className="bg-vibe-card rounded-lg p-3 text-xs font-mono text-vibe-text whitespace-pre-wrap break-words border border-vibe-border">
            {exportContent}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-vibe-muted text-sm mb-1">No changes to export</p>
              <p className="text-vibe-muted text-xs">
                Make some design changes first, then come back here to export
                them.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {exportContent && (
        <div className="flex gap-2 px-3 py-2 border-t border-vibe-border shrink-0">
          <button
            onClick={handleCopy}
            className="flex-1 text-xs bg-vibe-accent hover:bg-vibe-accent-hover text-white rounded-md py-1.5 transition-colors duration-150"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 text-xs bg-vibe-card hover:bg-vibe-border text-vibe-text border border-vibe-border rounded-md py-1.5 transition-colors duration-150"
          >
            Download
          </button>
        </div>
      )}
    </div>
  );
}
