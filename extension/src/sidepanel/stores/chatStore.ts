import { create } from "zustand";
import type {
  Message,
  Snapshot,
  SelectedElement,
  ChangeInstruction,
  ExtensionSettings,
} from "../../shared/types";
import { DEFAULT_BACKEND_URL, DEFAULT_API_KEY } from "../../shared/constants";

interface ChatState {
  // Messages
  messages: Message[];
  currentSession: string | null;
  isLoading: boolean;
  isConnected: boolean;

  // Element selection
  selectedElement: SelectedElement | null;

  // Snapshots
  snapshots: Snapshot[];

  // Settings
  backendUrl: string;
  apiKey: string;
  darkMode: boolean;
  autoSnapshot: boolean;

  // Export
  exportContent: string;
  exportFormat: "css" | "json" | "clipboard";

  // Actions
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setConnected: (connected: boolean) => void;
  setCurrentSession: (sessionId: string | null) => void;

  setSelectedElement: (element: SelectedElement | null) => void;

  addSnapshot: (snapshot: Snapshot) => void;
  removeSnapshot: (id: string) => void;
  setSnapshots: (snapshots: Snapshot[]) => void;
  restoreSnapshot: (snapshot: Snapshot) => void;

  setSettings: (settings: Partial<ExtensionSettings>) => void;

  setExportContent: (content: string) => void;
  setExportFormat: (format: "css" | "json" | "clipboard") => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  messages: [],
  currentSession: null,
  isLoading: false,
  isConnected: false,
  selectedElement: null,
  snapshots: [],
  backendUrl: DEFAULT_BACKEND_URL,
  apiKey: DEFAULT_API_KEY,
  darkMode: true,
  autoSnapshot: true,
  exportContent: "",
  exportFormat: "css",

  // Message actions
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  clearMessages: () => set({ messages: [] }),

  setLoading: (isLoading) => set({ isLoading }),

  setConnected: (isConnected) => set({ isConnected }),

  setCurrentSession: (currentSession) => set({ currentSession }),

  // Element selection
  setSelectedElement: (selectedElement) => set({ selectedElement }),

  // Snapshot actions
  addSnapshot: (snapshot) =>
    set((state) => ({ snapshots: [...state.snapshots, snapshot] })),

  removeSnapshot: (id) =>
    set((state) => ({
      snapshots: state.snapshots.filter((s) => s.id !== id),
    })),

  setSnapshots: (snapshots) => set({ snapshots }),

  restoreSnapshot: (_snapshot) => {
    // The actual restoration is handled by sending a message
    // to the content script via the service worker.
    // This action is a placeholder for UI state updates.
  },

  // Settings
  setSettings: (settings) =>
    set((state) => ({
      ...(settings.backendUrl !== undefined && {
        backendUrl: settings.backendUrl,
      }),
      ...(settings.apiKey !== undefined && { apiKey: settings.apiKey }),
      ...(settings.darkMode !== undefined && { darkMode: settings.darkMode }),
      ...(settings.autoSnapshot !== undefined && {
        autoSnapshot: settings.autoSnapshot,
      }),
    })),

  // Export
  setExportContent: (exportContent) => set({ exportContent }),
  setExportFormat: (exportFormat) => set({ exportFormat }),
}));
