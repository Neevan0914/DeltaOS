// Lets Tesseract load files from DeltaOS folders over deltaos-file://<host>/... so an HTML page (or an
// extracted HTML5 game) can load the scripts, images and WebAssembly next to it. Each folder gets its own
// host (origin), derived from its path, so pages can only read files from their own folder.
import { getState } from "./store";
import { getNode, normalize } from "./vfs";

const hosts = new Map<string, string>(); // host -> folder path

function hash64(s: string) {
  // FNV-1a, 64-bit, as hex
  let h = 0xcbf29ce484222325n;
  for (const ch of new TextEncoder().encode(s)) h = BigInt.asUintN(64, (h ^ BigInt(ch)) * 0x100000001b3n);
  return h.toString(16).padStart(16, "0");
}

export function serveDir(dir: string) {
  const d = normalize(dir);
  const host = "v" + hash64(d);
  hosts.set(host, d);
  return host;
}

/** URL Tesseract loads to show a DeltaOS file with its folder alongside. */
export function vfsUrl(path: string) {
  const p = normalize(path);
  const slash = p.lastIndexOf("/");
  const dir = p.slice(0, slash) || "/";
  return `deltaos-file://${serveDir(dir)}/${p.slice(slash + 1).split("/").map(encodeURIComponent).join("/")}`;
}

let started = false;
export function initVfsServe() {
  if (started || !window.deltaos) return;
  started = true;
  window.deltaos.vfs.onRead(({ host, path }) => {
    const dir = hosts.get(host);
    if (!dir) return { kind: "missing" };
    const full = normalize(`${dir}/${path}`);
    if (full !== dir && !full.startsWith(dir === "/" ? "/" : dir + "/")) return { kind: "missing" }; // stay inside the folder
    let node = getNode(getState().fs, full);
    if (node?.type === "dir") node = node.children["index.html"] ?? null;
    if (!node || node.type !== "file") return { kind: "missing" };
    return node.blob ? { kind: "blob", id: node.blob.id } : { kind: "text", text: node.content };
  });
}
