// Types shared by the Electron main process, the preload bridge and the renderer.
import type Anthropic from "@anthropic-ai/sdk";

export type ClaudeMessage = Anthropic.Beta.BetaMessageParam;
export type ClaudeTool = Anthropic.Beta.BetaTool;
export type ClaudeResponse = Anthropic.Beta.BetaMessage;

export interface ClaudeTurnRequest {
  requestId: string;
  system: string;
  messages: ClaudeMessage[];
  tools: ClaudeTool[];
}

export type ClaudeTurnResult =
  | { ok: true; message: ClaudeResponse }
  | { ok: false; error: string; kind: "no_key" | "auth" | "rate_limit" | "network" | "api" | "aborted" };

export interface ClaudeDelta {
  requestId: string;
  text: string;
}

export interface ClaudeStatus {
  configured: boolean;
  source: "settings" | "environment" | "none";
  model: string;
  encrypted: boolean;
}

export interface DeltaBridge {
  platform: string;
  versions: { electron: string; chrome: string; node: string };
  loadState(): Promise<string | null>;
  saveState(json: string): Promise<void>;
  quit(): void;
  reboot(): void;
  toggleFullscreen(): void;
  claude: {
    status(): Promise<ClaudeStatus>;
    setKey(key: string): Promise<ClaudeStatus>;
    clearKey(): Promise<ClaudeStatus>;
    turn(req: ClaudeTurnRequest): Promise<ClaudeTurnResult>;
    abort(requestId: string): void;
    onDelta(cb: (d: ClaudeDelta) => void): () => void;
  };
}
