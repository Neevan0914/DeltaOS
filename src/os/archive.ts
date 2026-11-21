import { getState, notify, setFs } from "./store";
import { basename, dirname, getNode, mkdir, uniqueName, writeBlob, writeFile, type VDir } from "./vfs";

export const isZip = (path: string) => /\.zip$/i.test(path);

/** Extract a downloaded .zip next to itself. Returns the new folder's path, or null on failure. */
export async function extractZip(path: string): Promise<string | null> {
  const node = getNode(getState().fs, path);
  if (node?.type !== "file" || !node.blob || !window.deltaos) {
    notify("Can't extract", `${basename(path)} isn't a zip archive DeltaOS can open`, "error");
    return null;
  }
  notify("Extracting…", basename(path), "info");
  const res = await window.deltaos.downloads.extract(node.blob.id);
  if (!res.ok) {
    notify("Couldn't extract", res.error, "error");
    return null;
  }
  // If everything sits inside one top-level folder, use that folder instead of nesting it again.
  const firstParts = new Set(res.entries.map((e) => e.path.split("/")[0]));
  const single = firstParts.size === 1 && res.entries.every((e) => e.path.includes("/"));
  const parent = dirname(path);
  const parentNode = getNode(getState().fs, parent) as VDir;
  const base = single ? [...firstParts][0] : basename(path).replace(/\.zip$/i, "");
  const target = `${parent === "/" ? "" : parent}/${uniqueName(parentNode, base)}`;
  setFs((root) => {
    let r = mkdir(root, target, true);
    for (const e of res.entries) {
      const rel = single ? e.path.split("/").slice(1).join("/") : e.path;
      const full = `${target}/${rel}`;
      r = mkdir(r, dirname(full), true);
      r = e.blob ? writeBlob(r, full, e.blob) : writeFile(r, full, e.text ?? "");
    }
    return r;
  });
  const hasIndex = res.entries.some((e) => /(^|\/)index\.html?$/i.test(e.path));
  notify("Extracted", `${res.entries.length} file${res.entries.length === 1 ? "" : "s"} → ${target.replace(/^\/home\/user/, "~")}${hasIndex ? " · open index.html to play" : ""}`, "success");
  return target;
}
