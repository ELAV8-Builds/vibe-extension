import React, { useState, useEffect } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { SnapshotTimeline } from "./components/SnapshotTimeline";
import { ExportPanel } from "./components/ExportPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ElementSelector } from "./components/ElementSelector";
import { useConnection } from "./hooks/useConnection";
import { useChatStore } from "./stores/chatStore";

type Tab = "chat" | "snapshots" | "export" | "settings";

const TAB_ITEMS: { key: Tab; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "snapshots", label: "Snapshots" },
  { key: "export", label: "Export" },
  { key: "settings", label: "Settings" },
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const { connected } = useConnection();
  const selectedElement = useChatStore((s) => s.selectedElement);

  // Load settings from chrome.storage on mount
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("vibe-settings", (result) => {
        const settings = result["vibe-settings"];
        if (settings) {
          useChatStore.getState().setSettings(settings);
        }
      });
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-vibe-bg text-vibe-text">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-vibe-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            V
          </div>
          <span className="font-semibold text-sm">Vibe</span>
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-vibe-success" : "bg-vibe-error"
            }`}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>
        <ElementSelector />
      </header>

      {/* Tab Bar */}
      <nav className="flex border-b border-vibe-border shrink-0">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors duration-150 ${
              activeTab === tab.key
                ? "text-vibe-accent border-b-2 border-vibe-accent"
                : "text-vibe-muted hover:text-vibe-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Selected Element Info */}
      {selectedElement && activeTab === "chat" && (
        <div className="px-3 py-2 bg-vibe-card border-b border-vibe-border text-xs text-vibe-muted animate-fade-in">
          <span className="text-vibe-accent font-mono">
            {selectedElement.breadcrumb}
          </span>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 min-h-0 tab-content">
        {activeTab === "chat" && <ChatPanel />}
        {activeTab === "snapshots" && <SnapshotTimeline />}
        {activeTab === "export" && <ExportPanel />}
        {activeTab === "settings" && <SettingsPanel />}
      </div>
    </div>
  );
}
