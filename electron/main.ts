import { app, BrowserWindow, ipcMain, Menu, session, shell, type WebContents } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as claude from "./claude";
import { log, logDir } from "./log";
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
      webviewTag: true,
    },
  });

  // Lock down every <webview> (Tesseract browser tabs, Code previews) before it attaches.
  win.webContents.on("will-attach-webview", (e, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.nodeIntegrationInSubFrames = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    prefs.webSecurity = true;
    if (params.src && !/^(https?:|data:|about:blank)/i.test(params.src)) e.preventDefault();
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
ipcMain.on("app:log", (_e, msg: string) => log("ui", String(msg).slice(0, 2000)));
ipcMain.handle("app:open-logs", () => shell.openPath(logDir()));

ipcMain.handle("claude:status", () => claude.status());
ipcMain.handle("claude:set-key", (_e, key: string) => claude.setKey(String(key ?? "")));
ipcMain.handle("claude:clear-key", () => claude.clearKey());
ipcMain.handle("claude:turn", (e, req: ClaudeTurnRequest) => claude.turn(req, e.sender));
ipcMain.on("claude:abort", (_e, id: string) => claude.abort(id));

/* ------------------------- Tesseract browser guests ------------------------- */

const SHORTCUTS = new Set(["ctrl+t", "ctrl+w", "ctrl+l", "ctrl+r", "f5", "alt+arrowleft", "alt+arrowright", "ctrl+space", "ctrl+alt+t", "ctrl+alt+e", "ctrl+tab", "ctrl+shift+tab", "ctrl+d", "escape"]);

function wireGuest(guest: WebContents) {
  const host = () => win?.webContents;
  const short = (u: string) => (u.startsWith("data:") ? "data:(inline document)" : u.slice(0, 200));
  guest.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) log("webview load failed", { code, desc, url: short(url) });
  });
  guest.on("render-process-gone", (_e, d) => log("webview renderer gone", { reason: d.reason, exitCode: d.exitCode, url: short(guest.getURL()) }));
  guest.on("unresponsive", () => log("webview unresponsive", short(guest.getURL())));
  guest.on("did-finish-load", () => log("webview loaded", short(guest.getURL())));
  guest.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) host()?.send("browser:event", { type: "open-tab", guestId: guest.id, url });
    return { action: "deny" };
  });
  guest.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    const combo = [input.control || input.meta ? "ctrl" : "", input.alt ? "alt" : "", input.shift ? "shift" : "", input.key === " " ? "space" : input.key.toLowerCase()]
      .filter(Boolean)
      .join("+");
    if (!SHORTCUTS.has(combo)) return;
    if (combo === "escape" && !guest.isLoading()) return;
    e.preventDefault();
    host()?.send("browser:event", { type: "shortcut", guestId: guest.id, combo });
  });
  guest.on("context-menu", (_e, p) => {
    host()?.send("browser:event", {
      type: "context-menu",
      guestId: guest.id,
      x: p.x,
      y: p.y,
      linkURL: p.linkURL,
      srcURL: p.mediaType === "image" ? p.srcURL : "",
      selectionText: p.selectionText,
      isEditable: p.isEditable,
    });
  });
}

app.on("child-process-gone", (_e, d) => log("child process gone", { type: d.type, reason: d.reason, exitCode: d.exitCode, name: d.name }));
app.on("render-process-gone", (_e, _wc, d) => log("renderer gone", { reason: d.reason, exitCode: d.exitCode }));

app.on("web-contents-created", (_e, contents) => {
  if (contents.getType() === "webview") wireGuest(contents);
});

function setupBrowserSession() {
  const ses = session.fromPartition("persist:tesseract");
  // Present as plain Chrome so sites don't serve degraded pages to "Electron".
  ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|deltaos|DeltaOS)\/\S+/g, ""));
  const allowed = new Set(["fullscreen", "clipboard-sanitized-write", "pointerLock"]);
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));
}

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
  app.whenReady().then(async () => {
    log("---- DeltaOS start", { version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, platform: `${process.platform} ${process.getSystemVersion()} ${process.arch}` });
    setupBrowserSession();
    createWindow();
    setTimeout(async () => {
      log("gpu features", app.getGPUFeatureStatus());
      try {
        const info = (await app.getGPUInfo("basic")) as { gpuDevice?: { vendorId: number; deviceId: number; active?: boolean; driverVersion?: string }[] };
        log("gpu devices", info.gpuDevice ?? []);
      } catch (e) {
        log("gpu info unavailable", String(e));
      }
    }, 4000);
  });
  app.on("window-all-closed", () => app.quit());
}
