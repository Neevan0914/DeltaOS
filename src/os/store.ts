import { useSyncExternalStore } from "react";
import { createDefaultFs, type VDir } from "./vfs";

export type AppId = "terminal" | "files" | "editor" | "folio" | "browser" | "games" | "settings" | "about" | "calculator";
export type Phase = "boot" | "login" | "desktop" | "shutdown" | "restart";

export interface Settings {
  theme: "dark" | "light";
  accent: string;
  wallpaper: string;
  transparency: boolean;
  animations: boolean;
  username: string;
  password: string;
  clock24: boolean;
  terminalTheme: TerminalTheme;
  browser: BrowserSettings;
  folio: FolioSettings;
}
export interface Bookmark {
  title: string;
  url: string;
}
export interface BrowserSettings {
  search: "google" | "duckduckgo" | "bing";
  bookmarks: Bookmark[];
}
export interface FolioSettings {
  font: "serif" | "sans" | "mono";
  size: number;
  width: "narrow" | "wide";
}
export type TerminalTheme = "delta" | "matrix" | "amber" | "ice";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WinState extends Rect {
  id: string;
  app: AppId;
  title: string;
  z: number;
  minimized: boolean;
  maximized: boolean;
  snapped: "left" | "right" | null;
  restore: Rect | null;
  props: Record<string, unknown>;
  closing: boolean;
}

export interface Toast {
  id: string;
  title: string;
  body: string;
  kind: "info" | "success" | "error" | "ai";
}

export interface OSState {
  phase: Phase;
  loaded: boolean;
  settings: Settings;
  fs: VDir;
  windows: WinState[];
  focusedId: string | null;
  nextZ: number;
  toasts: Toast[];
  startOpen: boolean;
  assistantOpen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  accent: "#7c5cff",
  wallpaper: "aurora",
  transparency: true,
  animations: true,
  username: "Delta User",
  password: "",
  clock24: false,
  terminalTheme: "delta",
  browser: {
    search: "google",
    bookmarks: [
      { title: "Wikipedia", url: "https://www.wikipedia.org/" },
      { title: "GitHub", url: "https://github.com/" },
      { title: "Anthropic", url: "https://www.anthropic.com/" },
      { title: "YouTube", url: "https://www.youtube.com/" },
      { title: "MDN Web Docs", url: "https://developer.mozilla.org/" },
      { title: "Hacker News", url: "https://news.ycombinator.com/" },
    ],
  },
  folio: { font: "serif", size: 18, width: "narrow" },
};

let state: OSState = {
  phase: "boot",
  loaded: false,
  settings: DEFAULT_SETTINGS,
  fs: createDefaultFs(),
  windows: [],
  focusedId: null,
  nextZ: 10,
  toasts: [],
  startOpen: false,
  assistantOpen: false,
};

const listeners = new Set<() => void>();

export function getState() {
  return state;
}

export function setState(update: Partial<OSState> | ((s: OSState) => Partial<OSState>)) {
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  if ("settings" in patch || "fs" in patch) schedulePersist();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useOS<T>(selector: (s: OSState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/* ----------------------------- persistence ----------------------------- */

const STORAGE_KEY = "deltaos-state-v1";
let persistTimer: ReturnType<typeof setTimeout> | undefined;

function schedulePersist() {
  if (!state.loaded) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 400);
}

export function persistNow() {
  clearTimeout(persistTimer);
  const json = JSON.stringify({ version: 1, settings: state.settings, fs: state.fs });
  try {
    if (window.deltaos) void window.deltaos.saveState(json);
    else localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* storage unavailable: keep running in memory */
  }
}

export async function loadPersisted() {
  try {
    const raw = window.deltaos ? await window.deltaos.loadState() : localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      setState({
        settings: {
          ...DEFAULT_SETTINGS,
          ...(data.settings ?? {}),
          browser: { ...DEFAULT_SETTINGS.browser, ...(data.settings?.browser ?? {}) },
          folio: { ...DEFAULT_SETTINGS.folio, ...(data.settings?.folio ?? {}) },
        },
        fs: data.fs?.type === "dir" ? data.fs : createDefaultFs(),
      });
    }
  } catch {
    /* corrupted state: fall back to defaults */
  }
  setState({ loaded: true });
}

window.addEventListener("beforeunload", () => persistNow());

/* ------------------------------- settings ------------------------------- */

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ settings: { ...s.settings, ...patch } }));
}

export function setFs(fn: (fs: VDir) => VDir) {
  setState((s) => ({ fs: fn(s.fs) }));
}

/* -------------------------------- toasts -------------------------------- */

let toastSeq = 0;
export function notify(title: string, body = "", kind: Toast["kind"] = "info") {
  const id = `t${++toastSeq}`;
  setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, title, body, kind }] }));
  setTimeout(() => dismissToast(id), 4500);
}
export function dismissToast(id: string) {
  setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
