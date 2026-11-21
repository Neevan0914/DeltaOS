import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { BrowserEvent, ClaudeDelta, DeltaBridge, DownloadEvent } from "../shared/ipc";

const bridge: DeltaBridge = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron ?? "",
    chrome: process.versions.chrome ?? "",
    node: process.versions.node ?? "",
  },
  loadState: () => ipcRenderer.invoke("state:load"),
  saveState: (json) => ipcRenderer.invoke("state:save", json),
  quit: () => ipcRenderer.send("app:quit"),
  reboot: () => ipcRenderer.send("app:reboot"),
  toggleFullscreen: () => ipcRenderer.send("app:toggle-fullscreen"),
  log: (msg) => ipcRenderer.send("app:log", msg),
  openLogs: () => ipcRenderer.invoke("app:open-logs"),
  onBrowserEvent: (cb) => {
    const listener = (_e: IpcRendererEvent, ev: BrowserEvent) => cb(ev);
    ipcRenderer.on("browser:event", listener);
    return () => ipcRenderer.removeListener("browser:event", listener);
  },
  downloads: {
    onEvent: (cb) => {
      const listener = (_e: IpcRendererEvent, ev: DownloadEvent) => cb(ev);
      ipcRenderer.on("downloads:event", listener);
      return () => ipcRenderer.removeListener("downloads:event", listener);
    },
    cancel: (id) => ipcRenderer.send("downloads:cancel", id),
    exportFile: (blobId, name) => ipcRenderer.invoke("downloads:export", blobId, name),
    collectGarbage: (ids) => ipcRenderer.send("downloads:gc", ids),
  },
  claude: {
    status: () => ipcRenderer.invoke("claude:status"),
    setKey: (key) => ipcRenderer.invoke("claude:set-key", key),
    clearKey: () => ipcRenderer.invoke("claude:clear-key"),
    turn: (req) => ipcRenderer.invoke("claude:turn", req),
    abort: (id) => ipcRenderer.send("claude:abort", id),
    onDelta: (cb) => {
      const listener = (_e: IpcRendererEvent, d: ClaudeDelta) => cb(d);
      ipcRenderer.on("claude:delta", listener);
      return () => ipcRenderer.removeListener("claude:delta", listener);
    },
  },
};

contextBridge.exposeInMainWorld("deltaos", bridge);
