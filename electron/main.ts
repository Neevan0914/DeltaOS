import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as claude from "./claude";
import type { ClaudeTurnRequest } from "../shared/ipc";

app.setName("DeltaOS");
// Keep user data next to other apps (%APPDATA%/DeltaOS) so the portable exe stays a single file.
const statePath = () => join(app.getPath("userData"), "deltaos-state.json");

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    fullscreen: !process.env.DELTAOS_WINDOWED,
    frame: false,
    backgroundColor: "#05060a",
    show: false,
    title: "DeltaOS",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && input.key === "F11") win?.setFullScreen(!win.isFullScreen());
    if (input.type === "keyDown" && input.key === "F12" && input.control && input.shift) win?.webContents.toggleDevTools();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(join(__dirname, "..", "renderer", "index.html"));

  win.on("closed", () => (win = null));
}

ipcMain.handle("state:load", () => {
  try {
    return existsSync(statePath()) ? readFileSync(statePath(), "utf8") : null;
  } catch {
    return null;
  }
});
ipcMain.handle("state:save", (_e, json: string) => {
  const dir = app.getPath("userData");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = statePath() + ".tmp";
  writeFileSync(tmp, json, "utf8");
  renameSync(tmp, statePath());
});
ipcMain.on("app:quit", () => app.quit());
ipcMain.on("app:reboot", () => {
  app.relaunch();
  app.exit(0);
});
ipcMain.on("app:toggle-fullscreen", () => win?.setFullScreen(!win.isFullScreen()));

ipcMain.handle("claude:status", () => claude.status());
ipcMain.handle("claude:set-key", (_e, key: string) => claude.setKey(String(key ?? "")));
ipcMain.handle("claude:clear-key", () => claude.clearKey());
ipcMain.handle("claude:turn", (e, req: ClaudeTurnRequest) => claude.turn(req, e.sender));
ipcMain.on("claude:abort", (_e, id: string) => claude.abort(id));

const single = app.requestSingleInstanceLock();
if (!single) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  Menu.setApplicationMenu(null);
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => app.quit());
}
