// DeltaOS's file services in the main process:
//  - downloads from web views are kept inside DeltaOS (private blob store → virtual ~/Downloads)
//  - zip archives in DeltaOS can be extracted into the virtual filesystem
//  - deltaos-file:// serves downloaded media and whole DeltaOS folders (e.g. an extracted HTML5 game) to Tesseract
import { app, dialog, ipcMain, protocol, session, type BrowserWindow, type DownloadItem } from "electron";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { unzipSync } from "fflate";
import type { DownloadEvent, ExtractResult, VfsReadReply } from "../shared/ipc";
import { log } from "./log";

export const BLOB_SCHEME = "deltaos-file";
const blobDir = () => join(app.getPath("userData"), "vfs-blobs");
const ID_RE = /^[0-9a-f-]{36}$/;
const active = new Map<string, DownloadItem>();
export const TEXT_EXT = new Set(["txt", "md", "markdown", "json", "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "cpp", "cc", "h", "hpp", "c", "cs", "css", "html", "htm", "xml", "svg", "csv", "log", "yml", "yaml", "toml", "ini", "sh", "gitignore"]);
const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4",
  pdf: "application/pdf", txt: "text/plain; charset=utf-8", html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json",
  wasm: "application/wasm", xml: "application/xml", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
};
const mimeFor = (name: string) => MIME[extname(name).slice(1).toLowerCase()] ?? "application/octet-stream";

export const blobPath = (id: string) => join(blobDir(), id);
let getWin: () => BrowserWindow | null = () => null;
const send = (channel: string, payload: unknown) => {
  const w = getWin();
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
};

/** Must run before app "ready". */
export function registerBlobScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: BLOB_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
}

/* ---------------------------- virtual folders ---------------------------- */

// The virtual filesystem lives in the UI process; ask it for a file and wait for the answer.
const pendingReads = new Map<string, (r: VfsReadReply) => void>();
ipcMain.on("vfs:read-reply", (_e, reqId: string, reply: VfsReadReply) => {
  pendingReads.get(reqId)?.(reply);
  pendingReads.delete(reqId);
});
function readVfs(host: string, path: string): Promise<VfsReadReply> {
  return new Promise((resolve) => {
    const reqId = randomUUID();
    pendingReads.set(reqId, resolve);
    send("vfs:read", { reqId, host, path });
    setTimeout(() => {
      if (pendingReads.delete(reqId)) resolve({ kind: "missing" });
    }, 10_000);
  });
}

function blobResponse(id: string, type: string, extraHeaders: Record<string, string> = {}) {
  const body = Readable.toWeb(createReadStream(blobPath(id))) as unknown as ReadableStream;
  return new Response(body, { headers: { "content-type": type, "content-length": String(statSync(blobPath(id)).size), ...extraHeaders } });
}

async function handleFileRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.hostname === "blob") {
    // deltaos-file://blob/<id>/<name>: a downloaded media file
    const [, id, name = ""] = url.pathname.split("/");
    if (!ID_RE.test(id ?? "") || !existsSync(blobPath(id))) return new Response("Not found", { status: 404 });
    return blobResponse(id, mimeFor(decodeURIComponent(name)));
  }
  // deltaos-file://v<token>/<path>: a file inside a DeltaOS folder that Tesseract opened. Each folder gets
  // its own origin, so a page can only read files from its own folder.
  if (!/^v[0-9a-f]{16}$/.test(url.hostname)) return new Response("Not found", { status: 404 });
  let rel = decodeURIComponent(url.pathname);
  // Pre-compressed web builds (e.g. Unity's .gz/.br) — tell the engine to decode them.
  const enc = rel.endsWith(".gz") ? "gzip" : rel.endsWith(".br") ? "br" : null;
  const typeName = enc ? rel.replace(/\.(gz|br)$/, "") : rel;
  if (rel.endsWith("/")) rel += "index.html";
  const r = await readVfs(url.hostname, rel);
  if (r.kind === "missing") return new Response("Not found in DeltaOS", { status: 404, headers: { "content-type": "text/plain" } });
  const headers: Record<string, string> = {
    // Cross-origin isolation lets WebAssembly games that use threads (e.g. Godot 4) run.
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-embedder-policy": "credentialless",
    "cache-control": "no-cache",
  };
  if (enc) headers["content-encoding"] = enc;
  const type = mimeFor(typeName.endsWith("/") ? "index.html" : typeName);
  if (r.kind === "text") return new Response(r.text, { headers: { "content-type": type, ...headers } });
  if (!ID_RE.test(r.id) || !existsSync(blobPath(r.id))) return new Response("Not found", { status: 404 });
  return blobResponse(r.id, type, headers);
}

/* -------------------------------- downloads ------------------------------- */

const attached = new Set<string>();
/** Keep downloads from this session inside DeltaOS. Safe to call more than once. */
export function attachDownloads(partition: string) {
  if (attached.has(partition)) return;
  attached.add(partition);
  const ses = session.fromPartition(partition);
  if (partition === "persist:tesseract") ses.protocol.handle(BLOB_SCHEME, handleFileRequest);

  ses.on("will-download", (_e, item) => {
    const id = randomUUID();
    item.setSavePath(blobPath(id)); // no "Save as" dialog, nothing written to the user's own folders
    active.set(id, item);
    const filename = item.getFilename() || "download";
    log("download started", { filename, url: item.getURL().slice(0, 200), partition });
    const source = partition === "persist:games" ? "games" : "tesseract";
    send("downloads:event", { type: "started", id, filename, url: item.getURL(), total: item.getTotalBytes(), source } satisfies DownloadEvent);
    let last = 0;
    item.on("updated", (_ev, state) => {
      const now = Date.now();
      if (state === "progressing" && now - last < 200) return;
      last = now;
      send("downloads:event", { type: "progress", id, received: item.getReceivedBytes(), total: item.getTotalBytes(), paused: item.isPaused() } satisfies DownloadEvent);
    });
    item.once("done", (_ev, state) => {
      active.delete(id);
      const size = existsSync(blobPath(id)) ? statSync(blobPath(id)).size : 0;
      log("download done", { filename, state, size });
      if (state !== "completed") {
        if (existsSync(blobPath(id))) unlinkSync(blobPath(id));
        send("downloads:event", { type: "done", id, state, size: 0, mime: "" } satisfies DownloadEvent);
        return;
      }
      const mime = item.getMimeType() || "application/octet-stream";
      // Small text files become ordinary DeltaOS files that Code, Folio and Terminal can open.
      const ext = extname(filename).slice(1).toLowerCase();
      if (size <= 2_000_000 && (TEXT_EXT.has(ext) || /^text\/|json|javascript|xml/.test(mime))) {
        const buf = readFileSync(blobPath(id));
        if (!buf.includes(0)) {
          unlinkSync(blobPath(id));
          send("downloads:event", { type: "done", id, state, size, mime, text: buf.toString("utf8") } satisfies DownloadEvent);
          return;
        }
      }
      send("downloads:event", { type: "done", id, state, size, mime } satisfies DownloadEvent);
    });
  });
}

export function setupDownloads(win: () => BrowserWindow | null, partitions: string[]) {
  getWin = win;
  if (!existsSync(blobDir())) mkdirSync(blobDir(), { recursive: true });
  for (const p of partitions) attachDownloads(p);
}

export function cancelDownload(id: string) {
  active.get(id)?.cancel();
}

/* --------------------------------- unzip --------------------------------- */

const MAX_TOTAL = 600 * 1024 * 1024;
const MAX_ENTRIES = 10_000;

/** Extract a zip from the blob store. Text files come back as text, everything else as new blobs. */
export function extractArchive(blobId: string): ExtractResult {
  if (!ID_RE.test(blobId) || !existsSync(blobPath(blobId))) return { ok: false, error: "Archive not found" };
  const data = new Uint8Array(readFileSync(blobPath(blobId)));
  let total = 0;
  let count = 0;
  try {
    // First pass reads only the directory, to refuse oversized archives before inflating anything.
    unzipSync(data, {
      filter: (f) => {
        total += f.originalSize;
        count++;
        return false;
      },
    });
    if (count > MAX_ENTRIES) return { ok: false, error: `Too many files (${count})` };
    if (total > MAX_TOTAL) return { ok: false, error: `Too large to extract (${Math.round(total / 1048576)} MB uncompressed; limit 600 MB)` };
    const files = unzipSync(data);
    const entries: ExtractResult & { ok: true } = { ok: true, entries: [] };
    for (const [rawName, bytes] of Object.entries(files)) {
      if (rawName.endsWith("/")) continue; // directory entry
      // Zip-slip protection: keep only plain path segments.
      const parts = rawName.split(/[\\/]+/).filter((p) => p && p !== "." && p !== ".." && !p.includes(":"));
      if (!parts.length) continue;
      const path = parts.join("/");
      const ext = extname(path).slice(1).toLowerCase();
      if (bytes.length <= 512 * 1024 && TEXT_EXT.has(ext) && !bytes.includes(0)) {
        entries.entries.push({ path, text: Buffer.from(bytes).toString("utf8") });
      } else {
        const id = randomUUID();
        writeFileSync(blobPath(id), bytes);
        entries.entries.push({ path, blob: { id, size: bytes.length, mime: mimeFor(path) } });
      }
    }
    log("extracted archive", { files: entries.entries.length, bytes: total });
    return entries;
  } catch (e) {
    return { ok: false, error: `Not a valid zip file (${e instanceof Error ? e.message : String(e)})` };
  }
}

/* ---------------------------- export / cleanup ---------------------------- */

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
      if (Date.now() - statSync(p).mtimeMs < 120_000) continue; // just downloaded / extracted
      unlinkSync(p);
      log("removed unreferenced blob", f);
    }
  } catch (e) {
    log("blob gc failed", String(e));
  }
}
