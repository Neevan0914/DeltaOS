import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { BrowserEvent, ClaudeDelta, DeltaBridge } from "../shared/ipc";

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
  onBrowserEvent: (cb) => {
    const listener = (_e: IpcRendererEvent, ev: BrowserEvent) => cb(ev);
    ipcRenderer.on("browser:event", listener);
    return () => ipcRenderer.removeListener("browser:event", listener);
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
