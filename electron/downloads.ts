// Downloads from DeltaOS's web views are kept inside DeltaOS: they are saved without a dialog into a
// private blob store (in DeltaOS's app-data folder) and appear in the virtual ~/Downloads folder.
import { app, dialog, protocol, session, type BrowserWindow, type DownloadItem } from "electron";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import type { DownloadEvent } from "../shared/ipc";
import { log } from "./log";

export const BLOB_SCHEME = "deltaos-file";
const blobDir = () => join(app.getPath("userData"), "vfs-blobs");
const ID_RE = /^[0-9a-f-]{36}$/;
const active = new Map<string, DownloadItem>();
const TEXT_EXT = new Set(["txt", "md", "markdown", "json", "js", "mjs", "ts", "tsx", "jsx", "py", "cpp", "cc", "h", "hpp", "c", "cs", "css", "html", "htm", "xml", "svg", "csv", "log", "yml", "yaml", "toml", "ini", "sh"]);
const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4",
  pdf: "application/pdf", txt: "text/plain; charset=utf-8", html: "text/html; charset=utf-8", json: "application/json",
};

export const blobPath = (id: string) => join(blobDir(), id);

/** Must run before app "ready". */
export function registerBlobScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: BLOB_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
}

export function setupDownloads(getWin: () => BrowserWindow | null, partitions: string[]) {
  if (!existsSync(blobDir())) mkdirSync(blobDir(), { recursive: true });
  const send = (ev: DownloadEvent) => {
    const w = getWin();
    if (w && !w.isDestroyed()) w.webContents.send("downloads:event", ev);
  };

  for (const partition of partitions) {
    const ses = session.fromPartition(partition);

    // deltaos-file://blob/<id>/<name> serves a downloaded file to Tesseract so images, video, audio
    // and web pages from ~/Downloads can be viewed without leaving DeltaOS.
    if (partition === "persist:tesseract") ses.protocol.handle(BLOB_SCHEME, (req) => {
      const [, id, name = ""] = new URL(req.url).pathname.split("/");
      if (!ID_RE.test(id ?? "") || !existsSync(blobPath(id))) return new Response("Not found", { status: 404 });
      const type = MIME[extname(decodeURIComponent(name)).slice(1).toLowerCase()] ?? "application/octet-stream";
      const body = Readable.toWeb(createReadStream(blobPath(id))) as unknown as ReadableStream;
      return new Response(body, { headers: { "content-type": type, "content-length": String(statSync(blobPath(id)).size) } });
    });

    ses.on("will-download", (_e, item) => {
      const id = randomUUID();
      item.setSavePath(blobPath(id)); // no "Save as" dialog, nothing written to the user's own folders
      active.set(id, item);
      const filename = item.getFilename() || "download";
      log("download started", { filename, url: item.getURL().slice(0, 200), partition });
      send({ type: "started", id, filename, url: item.getURL(), total: item.getTotalBytes(), source: partition === "persist:games" ? "games" : "tesseract" });
      let last = 0;
      item.on("updated", (_ev, state) => {
        const now = Date.now();
        if (state === "progressing" && now - last < 200) return;
        last = now;
        send({ type: "progress", id, received: item.getReceivedBytes(), total: item.getTotalBytes(), paused: item.isPaused() });
      });
      item.once("done", (_ev, state) => {
        active.delete(id);
        const size = existsSync(blobPath(id)) ? statSync(blobPath(id)).size : 0;
        log("download done", { filename, state, size });
        if (state !== "completed") {
          if (existsSync(blobPath(id))) unlinkSync(blobPath(id));
          send({ type: "done", id, state, size: 0, mime: "" });
          return;
        }
        const mime = item.getMimeType() || "application/octet-stream";
        // Small text files become ordinary DeltaOS files that Code, Folio and Terminal can open.
        const ext = extname(filename).slice(1).toLowerCase();
        if (size <= 2_000_000 && (TEXT_EXT.has(ext) || /^text\/|json|javascript|xml/.test(mime))) {
          const buf = readFileSync(blobPath(id));
          if (!buf.includes(0)) {
            unlinkSync(blobPath(id));
            send({ type: "done", id, state, size, mime, text: buf.toString("utf8") });
            return;
          }
        }
        send({ type: "done", id, state, size, mime });
      });
    });
  }
}

export function cancelDownload(id: string) {
  active.get(id)?.cancel();
}

/** Copy a file out of DeltaOS onto the real PC — only when the user explicitly asks. */
export async function exportBlob(win: BrowserWindow | null, id: string, suggestedName: string) {
  if (!ID_RE.test(id) || !existsSync(blobPath(id))) return { ok: false, error: "File not found" };
  const opts = { title: "Export from DeltaOS", defaultPath: join(app.getPath("downloads"), suggestedName) };
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
  if (r.canceled || !r.filePath) return { ok: false, error: "cancelled" };
  await copyFile(blobPath(id), r.filePath);
  log("exported file", { to: r.filePath });
  return { ok: true, path: r.filePath };
}

/** Delete blobs no longer referenced by the virtual filesystem (and not mid-download). */
let lastGc = 0;
export function collectGarbage(referenced: string[]) {
  if (Date.now() - lastGc < 30_000) return;
  lastGc = Date.now();
  const keep = new Set(referenced);
  try {
    for (const f of readdirSync(blobDir())) {
      if (!ID_RE.test(f) || keep.has(f) || active.has(f)) continue;
      const p = blobPath(f);
      if (Date.now() - statSync(p).mtimeMs < 120_000) continue; // a download that is just finishing
      unlinkSync(p);
      log("removed unreferenced blob", f);
    }
  } catch (e) {
    log("blob gc failed", String(e));
  }
}
