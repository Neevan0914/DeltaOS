import { useSyncExternalStore } from "react";
import type { DownloadEvent } from "../../shared/ipc";
import { getState, notify, setFs } from "./store";
import { basename, getNode, HOME, mkdir, uniqueName, writeBlob, writeFile, type VDir } from "./vfs";

export const DOWNLOADS_DIR = `${HOME}/Downloads`;

export interface Download {
  id: string;
  filename: string;
  url: string;
  source: "tesseract" | "games";
  received: number;
  total: number;
  state: "progressing" | "completed" | "cancelled" | "interrupted";
  /** Where the finished file lives in the virtual filesystem. */
  path?: string;
  started: number;
}

let list: Download[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
const patch = (id: string, p: Partial<Download>) => {
  list = list.map((d) => (d.id === id ? { ...d, ...p } : d));
  emit();
};

export function useDownloads() {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => list,
  );
}

export const cancelDownload = (id: string) => window.deltaos?.downloads.cancel(id);
export function clearFinished() {
  list = list.filter((d) => d.state === "progressing");
  emit();
}

function onEvent(ev: DownloadEvent) {
  if (ev.type === "started") {
    list = [{ id: ev.id, filename: ev.filename, url: ev.url, source: ev.source, received: 0, total: ev.total, state: "progressing" as const, started: Date.now() }, ...list].slice(0, 30);
    emit();
    return;
  }
  if (ev.type === "progress") return patch(ev.id, { received: ev.received, total: ev.total || ev.received });
  const d = list.find((x) => x.id === ev.id);
  if (!d) return;
  if (ev.state !== "completed") {
    patch(ev.id, { state: ev.state });
    if (ev.state === "interrupted") notify("Download failed", d.filename, "error");
    return;
  }
  // File the finished download into ~/Downloads inside DeltaOS.
  let path = "";
  try {
    setFs((root) => {
      let r = getNode(root, DOWNLOADS_DIR)?.type === "dir" ? root : mkdir(root, DOWNLOADS_DIR, true);
      const dir = getNode(r, DOWNLOADS_DIR) as VDir;
      const safe = basename(d.filename).replace(/[\\/]+/g, "_") || "download";
      const dot = safe.lastIndexOf(".");
      const name = dir.children[safe] ? uniqueName(dir, dot > 0 ? safe.slice(0, dot) : safe, dot > 0 ? safe.slice(dot) : "") : safe;
      path = `${DOWNLOADS_DIR}/${name}`;
      r = ev.text !== undefined ? writeFile(r, path, ev.text) : writeBlob(r, path, { id: ev.id, size: ev.size, mime: ev.mime });
      return r;
    });
    patch(ev.id, { state: "completed", received: ev.size, total: ev.size, path });
    notify("Download complete", `Saved to ~/Downloads/${basename(path)}`, "success");
  } catch (e) {
    patch(ev.id, { state: "interrupted" });
    notify("Couldn't save download", String(e), "error");
  }
}

let started = false;
/** Start listening for downloads (once, at startup). */
export function initDownloads() {
  if (started || !window.deltaos) return;
  started = true;
  window.deltaos.downloads.onEvent(onEvent);
}

export const isDownloading = () => list.some((d) => d.state === "progressing");
export { getState };
