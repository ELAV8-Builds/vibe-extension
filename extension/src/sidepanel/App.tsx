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
    <div className="flex flex-col h-full bg-vibe-bg text-vibe-text noise-overlay">
      {/* Header — Futuristic glassmorphism */}
      <header className="flex items-center justify-between px-4 py-3 glass-card shrink-0 relative overflow-hidden">
        {/* Ambient glow behind logo */}
        <div className="absolute -left-4 -top-4 w-20 h-20 bg-vibe-accent/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 via-amber-600 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-orange-500/20 animate-gradient">
            V
          </div>
          <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-vibe-text to-vibe-accent-hover bg-clip-text text-transparent">
            VIBE
          </span>
          <div className="relative">
            <span
              className={`w-2 h-2 rounded-full block ${
                connected ? "bg-vibe-success" : "bg-vibe-error"
              }`}
              title={connected ? "Connected" : "Disconnected"}
            />
            {connected && (
              <span className="absolute inset-0 w-2 h-2 rounded-full bg-vibe-success animate-ripple" />
            )}
          </div>
        </div>
        <ElementSelector />
      </header>

      {/* Tab Bar — Glowing underline */}
      <nav className="flex border-b border-vibe-border shrink-0 relative">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-all duration-200 relative ${
              activeTab === tab.key
                ? "text-vibe-accent"
                : "text-vibe-muted hover:text-vibe-text"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-vibe-accent to-transparent rounded-full shadow-[0_0_8px_var(--color-vibe-accent-glow)]" />
            )}
          </button>
        ))}
      </nav>

      {/* Selected Element Info — Cyber style */}
      {selectedElement && activeTab === "chat" && (
        <div className="px-3 py-2 glass-card border-b border-vibe-border text-xs text-vibe-muted animate-fade-in flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-vibe-cyan animate-pulse-dot" />
          <span className="text-vibe-cyan font-mono tracking-tight">
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
