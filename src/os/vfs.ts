// A small, persistent, in-memory virtual filesystem.
export interface VFile {
  type: "file";
  content: string;
  mtime: number;
}
export interface VDir {
  type: "dir";
  children: Record<string, VNode>;
  mtime: number;
}
export type VNode = VFile | VDir;

export const HOME = "/home/user";

export class FsError extends Error {}

const now = () => Date.now();
export const dir = (children: Record<string, VNode> = {}): VDir => ({ type: "dir", children, mtime: now() });
export const file = (content = ""): VFile => ({ type: "file", content, mtime: now() });

export function normalize(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

export function resolvePath(cwd: string, input: string): string {
  let p = input.trim();
  if (p === "~" || p.startsWith("~/")) p = HOME + p.slice(1);
  if (!p.startsWith("/")) p = cwd.replace(/\/$/, "") + "/" + p;
  return normalize(p);
}

export const basename = (p: string) => normalize(p).split("/").pop() || "/";
export const dirname = (p: string) => {
  const parts = normalize(p).split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/");
};
export const prettyPath = (p: string) => (p === HOME ? "~" : p.startsWith(HOME + "/") ? "~" + p.slice(HOME.length) : p);
export const extname = (name: string) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
};

export function getNode(root: VDir, path: string): VNode | null {
  const parts = normalize(path).split("/").filter(Boolean);
  let node: VNode = root;
  for (const part of parts) {
    if (node.type !== "dir") return null;
    const next: VNode | undefined = node.children[part];
    if (!next) return null;
    node = next;
  }
  return node;
}

/** Immutable update: clones every directory along `path` and hands the target parent to `fn`. */
function withParent(root: VDir, path: string, fn: (parent: VDir, name: string) => void): VDir {
  const parts = normalize(path).split("/").filter(Boolean);
  if (parts.length === 0) throw new FsError("Cannot modify the root directory");
  const name = parts.pop()!;
  const newRoot: VDir = { ...root, children: { ...root.children } };
  let cur = newRoot;
  for (const part of parts) {
    const next = cur.children[part];
    if (!next) throw new FsError(`No such directory: ${part}`);
    if (next.type !== "dir") throw new FsError(`Not a directory: ${part}`);
    const clone: VDir = { ...next, children: { ...next.children } };
    cur.children[part] = clone;
    cur = clone;
  }
  fn(cur, name);
  cur.mtime = now();
  return newRoot;
}

export function validName(name: string) {
  if (!name || name === "." || name === ".." || name.includes("/")) throw new FsError(`Invalid name: "${name}"`);
}

export function mkdir(root: VDir, path: string, parents = false): VDir {
  if (parents) {
    const parts = normalize(path).split("/").filter(Boolean);
    let acc = "";
    let r = root;
    for (const part of parts) {
      acc += "/" + part;
      const n = getNode(r, acc);
      if (!n) r = mkdir(r, acc);
      else if (n.type !== "dir") throw new FsError(`Not a directory: ${acc}`);
    }
    return r;
  }
  return withParent(root, path, (parent, name) => {
    validName(name);
    if (parent.children[name]) throw new FsError(`File exists: ${name}`);
    parent.children[name] = dir();
  });
}

export function writeFile(root: VDir, path: string, content: string): VDir {
  return withParent(root, path, (parent, name) => {
    validName(name);
    const existing = parent.children[name];
    if (existing?.type === "dir") throw new FsError(`Is a directory: ${name}`);
    parent.children[name] = { type: "file", content, mtime: now() };
  });
}

export function remove(root: VDir, path: string, recursive = false): VDir {
  return withParent(root, path, (parent, name) => {
    const node = parent.children[name];
    if (!node) throw new FsError(`No such file or directory: ${name}`);
    if (node.type === "dir" && Object.keys(node.children).length && !recursive)
      throw new FsError(`Directory not empty: ${name} (use rm -r)`);
    delete parent.children[name];
  });
}

export function rename(root: VDir, path: string, newName: string): VDir {
  validName(newName);
  return withParent(root, path, (parent, name) => {
    const node = parent.children[name];
    if (!node) throw new FsError(`No such file or directory: ${name}`);
    if (parent.children[newName]) throw new FsError(`"${newName}" already exists`);
    delete parent.children[name];
    parent.children[newName] = node;
  });
}

export function move(root: VDir, from: string, toDir: string): VDir {
  const node = getNode(root, from);
  if (!node) throw new FsError(`No such file or directory: ${from}`);
  const target = getNode(root, toDir);
  if (!target || target.type !== "dir") throw new FsError(`Not a directory: ${toDir}`);
  if (normalize(toDir).startsWith(normalize(from) + "/") || normalize(toDir) === normalize(from))
    throw new FsError("Cannot move a folder into itself");
  const name = basename(from);
  if (target.children[name]) throw new FsError(`"${name}" already exists there`);
  let r = remove(root, from, true);
  r = withParent(r, normalize(toDir) + "/" + name, (parent, n) => {
    parent.children[n] = node;
  });
  return r;
}

export function uniqueName(parent: VDir, base: string, ext = ""): string {
  let name = base + ext;
  let i = 2;
  while (parent.children[name]) name = `${base} ${i++}${ext}`;
  return name;
}

export function listDir(node: VDir): [string, VNode][] {
  return Object.entries(node.children).sort(([a, na], [b, nb]) => {
    if (na.type !== nb.type) return na.type === "dir" ? -1 : 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function nodeSize(node: VNode): number {
  if (node.type === "file") return new Blob([node.content]).size;
  return Object.values(node.children).reduce((s, c) => s + nodeSize(c), 0);
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function createDefaultFs(): VDir {
  return dir({
    home: dir({
      user: dir({
        Desktop: dir({
          "Welcome.md": file(`# Welcome to DeltaOS

DeltaOS is a simulated desktop operating system.

## Things to try
- Open **Terminal** and type \`help\`
- Press **Ctrl+Space** to summon the Claude assistant
- Ask Claude: "switch to light mode and use the Sunset wallpaper"
- Right-click the desktop to create files and folders
- Drag windows by their title bar, snap them to screen edges
- Personalise everything in **Settings**

Everything you create is saved automatically.
`),
          Projects: dir({}),
        }),
        Documents: dir({
          "notes.txt": file("Shopping list:\n- coffee beans\n- oat milk\n- a new keyboard\n"),
          "todo.md": file("# TODO\n\n- [x] Boot DeltaOS\n- [ ] Write something brilliant\n- [ ] Ask Claude for help\n"),
        }),
        Code: dir({
          "hello.ts": file(`// A tiny TypeScript program
interface Greeting {
  name: string;
  excited?: boolean;
}

export function greet({ name, excited = false }: Greeting): string {
  const message = \`Hello, \${name}\`;
  return excited ? message + "!" : message + ".";
}

console.log(greet({ name: "DeltaOS", excited: true }));
`),
          "fib.py": file(`# Fibonacci with memoisation
from functools import lru_cache


@lru_cache(maxsize=None)
def fib(n: int) -> int:
    """Return the n-th Fibonacci number."""
    return n if n < 2 else fib(n - 1) + fib(n - 2)


if __name__ == "__main__":
    print([fib(i) for i in range(15)])
`),
          "style.css": file(`:root {
  --accent: #7c5cff;
}

.card {
  border-radius: 16px;
  backdrop-filter: blur(24px);
  background: rgb(255 255 255 / 0.08);
}
`),
        }),
        Pictures: dir({}),
        Downloads: dir({}),
        ".deltarc": file("# DeltaOS shell configuration\nexport PROMPT=delta\n"),
      }),
    }),
    system: dir({
      "version.txt": file("DeltaOS 1.0 \"Aurora\"\n"),
      "motd.txt": file("Have a productive session.\n"),
    }),
    tmp: dir({}),
  });
}
