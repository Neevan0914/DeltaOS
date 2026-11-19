import { extname, basename } from "./vfs";
import { openApp } from "./windows";

/** File types that open in Folio (the writing app). Everything else opens in Code. */
const FOLIO_EXTS = new Set(["txt", "md", "markdown", "text", "log", "rtf"]);

export function isDocument(path: string) {
  const name = basename(path);
  if (name.startsWith(".")) return false;
  return FOLIO_EXTS.has(extname(name)) || !name.includes(".");
}

/** Open a file in the right app for its type. */
export function openPath(path: string) {
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
