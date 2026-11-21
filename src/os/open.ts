import { extname, basename, getNode } from "./vfs";
import { getState, notify } from "./store";
import { extractZip, isZip } from "./archive";
import { updateWindow, focusWindow } from "./windows";

/** Show a folder in the most recent Files window, or a new one. */
export function showFolder(dir: string) {
  const w = getState().windows.filter((x) => x.app === "files" && !x.closing).sort((a, b) => b.z - a.z)[0];
  if (w) {
    updateWindow(w.id, { props: { ...w.props, cwd: dir } });
    focusWindow(w.id);
  } else openApp("files", { cwd: dir });
}
import { openApp } from "./windows";

/** File types that open in Folio (the writing app). Everything else opens in Code. */
const FOLIO_EXTS = new Set(["txt", "md", "markdown", "text", "log", "rtf"]);

export function isDocument(path: string) {
  const name = basename(path);
  if (name.startsWith(".")) return false;
  return FOLIO_EXTS.has(extname(name)) || !name.includes(".");
}

export const isWebPage = (path: string) => ["html", "htm"].includes(extname(basename(path)));

const MEDIA_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "mp4", "webm", "mp3", "wav", "ogg", "m4a"]);
/** Downloaded binary files DeltaOS can show (in Tesseract). */
export const isViewableBinary = (path: string) => MEDIA_EXTS.has(extname(basename(path)));

/** Open a file in the right app for its type: documents in Folio, web pages in Tesseract, code in Code. */
export function openPath(path: string) {
  const node = getNode(getState().fs, path);
  if (node?.type === "file" && node.blob) {
    if (isViewableBinary(path)) return openApp("browser", { file: path });
    if (isWebPage(path)) return openApp("browser", { file: path });
    if (isZip(path)) {
      // Like a real OS: opening a zip unpacks it and shows the folder.
      void extractZip(path).then((dir) => dir && showFolder(dir));
      return;
    }
    notify(`DeltaOS can't open ${basename(path)}`, "To use it on your PC, right-click it in Files → Export to this PC…", "info");
    // Show it in Files, unless a Files window is already open (you probably double-clicked it there).
    if (!getState().windows.some((w) => w.app === "files" && !w.closing)) openApp("files", { cwd: path.slice(0, path.lastIndexOf("/")) || "/" });
    return;
  }
  if (isWebPage(path)) return openApp("browser", { file: path });
  return isDocument(path) ? openApp("folio", { path }) : openApp("editor", { path });
}

/** Turn what the user typed into a URL, or a search for it. */
export function toUrl(input: string, search: "google" | "duckduckgo" | "bing" = "google") {
  const q = input.trim();
  if (!q) return "";
  if (/^(https?:\/\/|about:|data:)/i.test(q)) return q;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(q) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(q)) return "http://" + q;
  if (!/\s/.test(q) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(q)) return "https://" + q;
  const enc = encodeURIComponent(q);
  if (search === "duckduckgo") return `https://duckduckgo.com/?q=${enc}`;
  if (search === "bing") return `https://www.bing.com/search?q=${enc}`;
  return `https://www.google.com/search?q=${enc}`;
}
