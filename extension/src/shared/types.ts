// ─── DOM Snapshot Types ───

export interface DOMSnapshot {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  designTokens: DesignTokens;
  tree: DOMNode;
  totalElements: number;
  extractedElements: number;
}

export interface DesignTokens {
  colors: { value: string; count: number; usage: string }[];
  fonts: { family: string; weights: number[]; usage: string }[];
  spacing: number[];
  radii: number[];
}

export interface DOMNode {
  tag: string;
  id?: string;
  classes?: string[];
  styles?: Record<string, string>;
  text?: string;
  bounds?: { x: number; y: number; w: number; h: number };
  children?: DOMNode[];
  collapsed?: string;
}

// ─── Change Instructions ───

export interface ChangeInstruction {
  id?: string;
  type: "css" | "dom";
  // CSS change fields
  selector?: string;
  properties?: Record<string, string>;
  // DOM change fields
  action?:
    | "setAttribute"
    | "addClass"
    | "removeClass"
    | "setText"
    | "moveElement"
    | "wrapElement";
  attribute?: string;
  value?: string;
}

export interface AIDesignResponse {
  changes: ChangeInstruction[];
  description: string;
  suggestions: string[];
  reasoning?: string;
}

// ─── Session & Messages ───

export interface ChatSession {
  id: string;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  changes?: ChangeInstruction[];
  description?: string;
  suggestions?: string[];
  timestamp: string;
}

// ─── Snapshots ───

export interface Snapshot {
  id: string;
  sessionId: string;
  cssState: string;
  domChanges: ChangeInstruction[];
  thumbnail?: string; // base64 data URI
  description: string;
  messageIndex?: number;
  createdAt: string;
}

// ─── Element Selection ───

export interface SelectedElement {
  tag: string;
  id?: string;
  classes: string[];
  styles: Record<string, string>;
  text?: string;
  breadcrumb: string;
  selector: string;
  context?: DOMNode;
  bounds: { x: number; y: number; w: number; h: number };
}

// ─── Settings ───

export interface ExtensionSettings {
  backendUrl: string;
  apiKey: string;
  darkMode: boolean;
  autoSnapshot: boolean;
}

// ─── Applied Change Tracking ───

export interface AppliedChange {
  id: string;
  instruction: ChangeInstruction;
  timestamp: number;
  cssRule?: string;
}
