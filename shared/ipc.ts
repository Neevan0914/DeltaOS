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

export type BrowserEvent =
  | { type: "open-tab"; guestId: number; url: string }
  | { type: "shortcut"; guestId: number; combo: string }
  | { type: "games-blocked"; guestId: number; url: string }
  | { type: "webapp-external"; guestId: number; url: string }
  | {
      type: "context-menu";
      guestId: number;
      x: number;
      y: number;
      linkURL: string;
      srcURL: string;
      selectionText: string;
      isEditable: boolean;
    };

export type DownloadEvent =
  | { type: "started"; id: string; filename: string; url: string; total: number; source: "tesseract" | "games" }
  | { type: "progress"; id: string; received: number; total: number; paused: boolean }
  | { type: "done"; id: string; state: "completed" | "cancelled" | "interrupted"; size: number; mime: string; text?: string };

export type VfsReadReply = { kind: "text"; text: string } | { kind: "blob"; id: string } | { kind: "missing" };
export type ExtractResult =
  | { ok: true; entries: { path: string; text?: string; blob?: { id: string; size: number; mime: string } }[] }
  | { ok: false; error: string };

export interface DeltaBridge {
  platform: string;
  versions: { electron: string; chrome: string; node: string };
  loadState(): Promise<string | null>;
  saveState(json: string): Promise<void>;
  quit(): void;
  reboot(): void;
  toggleFullscreen(): void;
  log(message: string): void;
  openLogs(): Promise<string>;
  onBrowserEvent(cb: (e: BrowserEvent) => void): () => void;
  downloads: {
    onEvent(cb: (e: DownloadEvent) => void): () => void;
    cancel(id: string): void;
    exportFile(blobId: string, name: string): Promise<{ ok: boolean; path?: string; error?: string }>;
    collectGarbage(referencedBlobIds: string[]): void;
    extract(blobId: string): Promise<ExtractResult>;
  };
  webapps: {
    prepare(id: string): Promise<boolean>;
    clearData(id: string): Promise<boolean>;
  };
  vfs: {
    onRead(cb: (req: { reqId: string; host: string; path: string }) => VfsReadReply): () => void;
  };
  claude: {
    status(): Promise<ClaudeStatus>;
    setKey(key: string): Promise<ClaudeStatus>;
    clearKey(): Promise<ClaudeStatus>;
    turn(req: ClaudeTurnRequest): Promise<ClaudeTurnResult>;
    abort(requestId: string): void;
    onDelta(cb: (d: ClaudeDelta) => void): () => void;
  };
}
