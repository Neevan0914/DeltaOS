import { APPS } from "../apps/registry";
import { getState, setState, type AppId, type Rect, type WinState } from "./store";

export const TASKBAR_H = 56;
let seq = 0;

export function viewport(): Rect {
  return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight - TASKBAR_H };
}

export function openApp(app: AppId, props: Record<string, unknown> = {}) {
  const def = APPS[app];
  const s = getState();
  // A URL opens as a new tab in the most recent browser window, if there is one.
  if (app === "browser" && (props.url || props.file || props.html)) {
    const existing = s.windows.filter((w) => w.app === "browser" && !w.closing).sort((a, b) => b.z - a.z)[0];
    if (existing) {
      updateWindow(existing.id, { props: { url: props.url, file: props.file, html: props.html, label: props.label, nonce: Date.now() } });
      focusWindow(existing.id);
      return existing.id;
    }
  }
  if (def.singleton || props.path) {
    const existing = s.windows.find(
      (w) => w.app === app && !w.closing && (def.singleton || (props.path && w.props.path === props.path)),
    );
    if (existing) {
      if (props && Object.keys(props).length) updateWindow(existing.id, { props: { ...existing.props, ...props } });
      focusWindow(existing.id);
      return existing.id;
    }
  }
  const vp = viewport();
  const w = Math.min(def.size.w, vp.w - 40);
  const h = Math.min(def.size.h, vp.h - 40);
  const open = s.windows.filter((x) => !x.closing).length;
  const offset = (open % 6) * 28;
  const id = `w${++seq}`;
  const win: WinState = {
    id,
    app,
    title: def.title,
    x: Math.max(12, Math.round((vp.w - w) / 2 - 90 + offset)),
    y: Math.max(12, Math.round((vp.h - h) / 2 - 50 + offset)),
    w,
    h,
    z: s.nextZ,
    minimized: false,
    maximized: false,
    snapped: null,
    restore: null,
    props,
    closing: false,
  };
  setState({ windows: [...s.windows, win], focusedId: id, nextZ: s.nextZ + 1, startOpen: false });
  return id;
}

export function updateWindow(id: string, patch: Partial<WinState>) {
  setState((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
}

export function focusWindow(id: string) {
  setState((s) => {
    const w = s.windows.find((x) => x.id === id);
    if (!w) return {};
    if (s.focusedId === id && !w.minimized && w.z === s.nextZ - 1) return {};
    return {
      windows: s.windows.map((x) => (x.id === id ? { ...x, z: s.nextZ, minimized: false } : x)),
      focusedId: id,
      nextZ: s.nextZ + 1,
    };
  });
}

export function closeWindow(id: string) {
  updateWindow(id, { closing: true });
  setState((s) => (s.focusedId === id ? { focusedId: topWindow(s.windows, id)?.id ?? null } : {}));
  setTimeout(() => setState((s) => ({ windows: s.windows.filter((w) => w.id !== id) })), 170);
}

export function closeApp(app: AppId) {
  getState()
    .windows.filter((w) => w.app === app)
    .forEach((w) => closeWindow(w.id));
}

export function minimizeWindow(id: string) {
  updateWindow(id, { minimized: true });
  setState((s) => (s.focusedId === id ? { focusedId: topWindow(s.windows, id)?.id ?? null } : {}));
}

export function toggleMaximize(id: string) {
  const w = getState().windows.find((x) => x.id === id);
  if (!w) return;
  if (w.maximized || w.snapped) {
    const r = w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h };
    updateWindow(id, { ...r, maximized: false, snapped: null, restore: null });
  } else {
    const vp = viewport();
    updateWindow(id, { restore: { x: w.x, y: w.y, w: w.w, h: w.h }, maximized: true, snapped: null, ...vp });
  }
}

export function snapWindow(id: string, side: "left" | "right" | "max") {
  const w = getState().windows.find((x) => x.id === id);
  if (!w) return;
  const vp = viewport();
  const restore = w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h };
  if (side === "max") return updateWindow(id, { restore, maximized: true, snapped: null, ...vp });
  const half = Math.round(vp.w / 2);
  updateWindow(id, {
    restore,
    maximized: false,
    snapped: side,
    x: side === "left" ? 0 : half,
    y: 0,
    w: side === "left" ? half : vp.w - half,
    h: vp.h,
  });
}

/** Taskbar click: focus, minimize if already focused, or restore. */
export function taskbarActivate(app: AppId) {
  const s = getState();
  const wins = s.windows.filter((w) => w.app === app && !w.closing).sort((a, b) => b.z - a.z);
  if (!wins.length) return openApp(app);
  const top = wins[0];
  if (s.focusedId === top.id && !top.minimized) minimizeWindow(top.id);
  else focusWindow(top.id);
}

function topWindow(windows: WinState[], exclude: string) {
  return windows
    .filter((w) => w.id !== exclude && !w.minimized && !w.closing)
    .sort((a, b) => b.z - a.z)[0];
}

/** Keep maximized/snapped windows fitted when the screen resizes. */
window.addEventListener("resize", () => {
  const vp = viewport();
  setState((s) => ({
    windows: s.windows.map((w) => {
      if (w.maximized) return { ...w, ...vp };
      if (w.snapped) {
        const half = Math.round(vp.w / 2);
        return { ...w, x: w.snapped === "left" ? 0 : half, y: 0, w: w.snapped === "left" ? half : vp.w - half, h: vp.h };
      }
      return { ...w, x: Math.min(w.x, vp.w - 120), y: Math.min(w.y, vp.h - 40) };
    }),
  }));
});
