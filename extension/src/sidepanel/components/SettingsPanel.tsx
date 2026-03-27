import React, { useState, useCallback, useEffect } from "react";
import { useChatStore } from "../stores/chatStore";
import { STORAGE_KEY_SETTINGS } from "../../shared/constants";
import { MessageType } from "../../shared/messages";
import type { ExtensionSettings } from "../../shared/types";

export function SettingsPanel() {
  const { backendUrl, apiKey, darkMode, autoSnapshot, setSettings } =
    useChatStore();

  const [localUrl, setLocalUrl] = useState(backendUrl);
  const [localKey, setLocalKey] = useState(apiKey);
  const [localDark, setLocalDark] = useState(darkMode);
  const [localAutoSnap, setLocalAutoSnap] = useState(autoSnapshot);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalUrl(backendUrl);
    setLocalKey(apiKey);
    setLocalDark(darkMode);
    setLocalAutoSnap(autoSnapshot);
  }, [backendUrl, apiKey, darkMode, autoSnapshot]);

  const handleSave = useCallback(() => {
    const settings: ExtensionSettings = {
      backendUrl: localUrl,
      apiKey: localKey,
      darkMode: localDark,
      autoSnapshot: localAutoSnap,
    };

    setSettings(settings);

    // Persist to chrome.storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings });
    }

    // Notify service worker to update its cached settings
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: MessageType.UPDATE_SETTINGS,
        settings,
      }).catch(() => {
        // Service worker may not be listening; settings will reload on next startup
      });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [localUrl, localKey, localDark, localAutoSnap, setSettings]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Backend URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-vibe-muted">
            Backend URL
          </label>
          <input
            type="text"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
            placeholder="http://localhost:5100"
            className="w-full bg-vibe-card text-vibe-text placeholder-vibe-muted rounded-lg px-3 py-2 text-sm border border-vibe-border focus:border-vibe-accent outline-none transition-colors duration-150"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-vibe-muted">
            API Key
          </label>
          <input
            type="password"
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            placeholder="Enter your API key"
            className="w-full bg-vibe-card text-vibe-text placeholder-vibe-muted rounded-lg px-3 py-2 text-sm border border-vibe-border focus:border-vibe-accent outline-none transition-colors duration-150"
          />
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-vibe-muted">
            Dark Mode
          </span>
          <button
            onClick={() => setLocalDark(!localDark)}
            className={`w-10 h-5 rounded-full transition-colors duration-200 relative ${
              localDark ? "bg-vibe-accent" : "bg-vibe-border"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                localDark ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Auto Snapshot */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-vibe-muted">
            Auto-save Snapshots
          </span>
          <button
            onClick={() => setLocalAutoSnap(!localAutoSnap)}
            className={`w-10 h-5 rounded-full transition-colors duration-200 relative ${
              localAutoSnap ? "bg-vibe-accent" : "bg-vibe-border"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                localAutoSnap ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save button */}
      <div className="px-4 py-3 border-t border-vibe-border shrink-0">
        <button
          onClick={handleSave}
          className="w-full text-xs bg-vibe-accent hover:bg-vibe-accent-hover text-white rounded-md py-2 transition-colors duration-150"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
