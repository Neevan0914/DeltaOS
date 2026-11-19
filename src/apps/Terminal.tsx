import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AppProps } from "../components/AppHost";
import { getState, notify, setFs, useOS, type AppId, type TerminalTheme } from "../os/store";
import { closeWindow, openApp, updateWindow } from "../os/windows";
import { APP_IDS, findWallpaper, setAccent, setTerminalTheme, setTheme, setWallpaper } from "../os/actions";
import { sendMessage, toggleAssistant } from "../os/assistant";
import { openPath } from "../os/open";
import { ACCENTS, accentName } from "../os/theme";
import { WALLPAPERS, wallpaperById } from "../os/wallpapers";
import {
  basename, dirname, formatSize, FsError, getNode, HOME, listDir, mkdir, move, nodeSize, prettyPath, remove, rename, resolvePath, writeFile,
  type VDir,
} from "../os/vfs";

interface Line {
  id: number;
  kind: "cmd" | "out" | "err" | "node";
  text?: string;
  cwd?: string;
  node?: ReactNode;
}

const THEMES: Record<TerminalTheme, { bg: string; fg: string; prompt: string; path: string; dim: string }> = {
  delta: { bg: "rgb(10 11 20 / 0.86)", fg: "#e6e8f2", prompt: "var(--os-accent)", path: "#67e8f9", dim: "#7d8299" },
  matrix: { bg: "rgb(0 8 2 / 0.9)", fg: "#86efac", prompt: "#22c55e", path: "#4ade80", dim: "#3f7a50" },
  amber: { bg: "rgb(18 10 0 / 0.9)", fg: "#fcd34d", prompt: "#f59e0b", path: "#fbbf24", dim: "#8a6a2a" },
  ice: { bg: "rgb(6 16 28 / 0.86)", fg: "#e0f2fe", prompt: "#38bdf8", path: "#a5f3fc", dim: "#5d7d96" },
};

const COMMANDS: Record<string, string> = {
  help: "Show this help",
  ls: "List directory contents  (ls [-a] [-l] [path])",
  cd: "Change directory  (cd [path])",
  pwd: "Print working directory",
  cat: "Print file contents  (cat <file>…)",
  mkdir: "Create directories  (mkdir [-p] <dir>…)",
  touch: "Create empty files  (touch <file>…)",
  rm: "Remove files  (rm [-r] <path>…)",
  mv: "Move or rename  (mv <src> <dest>)",
  echo: "Print text, or write to a file with > / >>",
  tree: "Show a directory tree",
  clear: "Clear the screen  (Ctrl+L)",
  theme: "Change appearance  (theme dark|light | theme accent <color> | theme wallpaper <name> | theme terminal <name>)",
  open: "Open an app or a path  (open files | open ~/Documents)",
  edit: "Open a file in the Code editor",
  write: "Open a document in Folio  (write [file])",
  browse: "Open a website in Tesseract  (browse <url or search>)",
  ask: "Ask Claude a question  (ask <question>)",
  neofetch: "Show system information",
  whoami: "Print the current user",
  date: "Print the date and time",
  history: "Show command history",
  exit: "Close this terminal",
};

let lineSeq = 0;

export function Terminal({ win }: AppProps) {
  const themeName = useOS((s) => s.settings.terminalTheme);
  const username = useOS((s) => s.settings.username);
  const user = username.toLowerCase().replace(/[^a-z0-9]+/g, "") || "user";
  const theme = THEMES[themeName] ?? THEMES.delta;
  const [cwd, setCwd] = useState<string>(() => {
    const c = win.props.cwd as string | undefined;
    return c && getNode(getState().fs, c)?.type === "dir" ? c : HOME;
  });
  const [lines, setLines] = useState<Line[]>(() => [
    { id: ++lineSeq, kind: "node", node: <Banner /> },
  ]);
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    updateWindow(win.id, { title: `Terminal — ${prettyPath(cwd)}` });
  }, [cwd, win.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const print = (...ls: Omit<Line, "id">[]) => setLines((prev) => [...prev, ...ls.map((l) => ({ ...l, id: ++lineSeq }))]);
  const out = (text: string) => print({ kind: "out", text });
  const err = (text: string) => print({ kind: "err", text });

  const run = (raw: string) => {
    const lineCwd = cwd;
    print({ kind: "cmd", text: raw, cwd: lineCwd });
    const trimmed = raw.trim();
    if (!trimmed) return;
    setHist((h) => (h[h.length - 1] === trimmed ? h : [...h, trimmed]));

    // Redirection: echo foo > file
    let redirect: { path: string; append: boolean } | null = null;
    let cmdline = trimmed;
    const m = trimmed.match(/^(.*?)\s*(>>?)\s*(\S+)\s*$/);
    if (m && !trimmed.startsWith("ask ")) {
      cmdline = m[1];
      redirect = { path: m[3], append: m[2] === ">>" };
    }
    const args = tokenize(cmdline);
    const cmd = args.shift()!.toLowerCase();
    const flags = new Set(args.filter((a) => /^-[a-z]+$/i.test(a)).flatMap((a) => a.slice(1).split("")));
    const pos = args.filter((a) => !/^-[a-z]+$/i.test(a));
    const fs = () => getState().fs;
    const abs = (p: string) => resolvePath(cwd, p);

    try {
      let output: string | null = null;
      switch (cmd) {
        case "help": {
          print({
            kind: "node",
            node: (
              <div>
                <div style={{ color: theme.prompt }} className="font-semibold mb-1">DeltaOS shell — available commands</div>
                {Object.entries(COMMANDS).map(([c, d]) => (
                  <div key={c} className="flex">
                    <span className="w-24 shrink-0" style={{ color: theme.path }}>{c}</span>
                    <span style={{ color: theme.dim }}>{d}</span>
                  </div>
                ))}
                <div className="mt-1" style={{ color: theme.dim }}>Tips: ↑/↓ history · Tab completes · Ctrl+L clears · Ctrl+C cancels</div>
              </div>
            ),
          });
          break;
        }
        case "ls":
        case "dir": {
          const targets = pos.length ? pos : ["."];
          for (const t of targets) {
            const node = getNode(fs(), abs(t));
            if (!node) throw new FsError(`ls: cannot access '${t}': No such file or directory`);
            if (node.type === "file") {
              out(basename(abs(t)));
              continue;
            }
            const entries = listDir(node).filter(([n]) => flags.has("a") || !n.startsWith("."));
            if (targets.length > 1) out(`${t}:`);
            if (flags.has("l")) {
              print({
                kind: "node",
                node: (
                  <div>
                    {entries.map(([n, e]) => (
                      <div key={n} className="flex gap-4">
                        <span style={{ color: theme.dim }}>{e.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--"}</span>
                        <span className="w-16 text-right" style={{ color: theme.dim }}>{formatSize(nodeSize(e))}</span>
                        <span style={{ color: theme.dim }}>{new Date(e.mtime).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        <span style={{ color: e.type === "dir" ? theme.path : theme.fg, fontWeight: e.type === "dir" ? 600 : 400 }}>{n}{e.type === "dir" ? "/" : ""}</span>
                      </div>
                    ))}
                  </div>
                ),
              });
            } else if (entries.length) {
              print({
                kind: "node",
                node: (
                  <div className="flex flex-wrap gap-x-6">
                    {entries.map(([n, e]) => (
                      <span key={n} style={{ color: e.type === "dir" ? theme.path : theme.fg, fontWeight: e.type === "dir" ? 600 : 400 }}>
                        {n}{e.type === "dir" ? "/" : ""}
                      </span>
                    ))}
                  </div>
                ),
              });
            }
          }
          break;
        }
        case "cd": {
          const target = abs(pos[0] ?? "~");
          const node = getNode(fs(), target);
          if (!node) throw new FsError(`cd: no such file or directory: ${pos[0]}`);
          if (node.type !== "dir") throw new FsError(`cd: not a directory: ${pos[0]}`);
          setCwd(target);
          break;
        }
        case "pwd":
          output = cwd;
          break;
        case "cat": {
          if (!pos.length) throw new FsError("cat: missing file operand");
          output = pos
            .map((p) => {
              const node = getNode(fs(), abs(p));
              if (!node) throw new FsError(`cat: ${p}: No such file or directory`);
              if (node.type === "dir") throw new FsError(`cat: ${p}: Is a directory`);
              return node.content.replace(/\n$/, "");
            })
            .join("\n");
          break;
        }
        case "mkdir": {
          if (!pos.length) throw new FsError("mkdir: missing operand");
          for (const p of pos) setFs((r) => mkdir(r, abs(p), flags.has("p")));
          break;
        }
        case "touch": {
          if (!pos.length) throw new FsError("touch: missing file operand");
          for (const p of pos) {
            const n = getNode(fs(), abs(p));
            if (n?.type === "dir") continue;
            setFs((r) => writeFile(r, abs(p), n?.type === "file" ? n.content : ""));
          }
          break;
        }
        case "rm": {
          if (!pos.length) throw new FsError("rm: missing operand");
          for (const p of pos) {
            const a = abs(p);
            if (a === "/" || a === HOME) throw new FsError(`rm: refusing to remove '${p}'`);
            const n = getNode(fs(), a);
            if (!n) throw new FsError(`rm: cannot remove '${p}': No such file or directory`);
            if (n.type === "dir" && !flags.has("r")) throw new FsError(`rm: cannot remove '${p}': Is a directory (use -r)`);
            setFs((r) => remove(r, a, true));
          }
          break;
        }
        case "mv": {
          if (pos.length < 2) throw new FsError("mv: usage: mv <source> <destination>");
          const src = abs(pos[0]);
          const dest = abs(pos[1]);
          const destNode = getNode(fs(), dest);
          if (destNode?.type === "dir") setFs((r) => move(r, src, dest));
          else {
            if (destNode) throw new FsError(`mv: '${pos[1]}' already exists`);
            const parent = dirname(dest);
            const sameDir = parent === dirname(src);
            setFs((r) => {
              const moved = sameDir ? r : move(r, src, parent);
              const at = sameDir ? src : `${parent}/${basename(src)}`;
              return basename(dest) === basename(at) ? moved : rename(moved, at, basename(dest));
            });
          }
          break;
        }
        case "echo":
          output = pos.join(" ");
          break;
        case "tree": {
          const root = abs(pos[0] ?? ".");
          const node = getNode(fs(), root);
          if (!node || node.type !== "dir") throw new FsError(`tree: '${pos[0] ?? "."}' is not a directory`);
          const linesOut: string[] = [prettyPath(root)];
          const walk = (d: VDir, prefix: string) => {
            const entries = listDir(d).filter(([n]) => !n.startsWith("."));
            entries.forEach(([n, e], i) => {
              const last = i === entries.length - 1;
              linesOut.push(`${prefix}${last ? "└── " : "├── "}${n}${e.type === "dir" ? "/" : ""}`);
              if (e.type === "dir") walk(e, prefix + (last ? "    " : "│   "));
            });
          };
          walk(node, "");
          output = linesOut.join("\n");
          break;
        }
        case "clear":
        case "cls":
          setLines([]);
          break;
        case "theme": {
          const [sub, ...rest] = pos;
          const val = rest.join(" ");
          if (!sub) {
            const s = getState().settings;
            output = [
              `mode       ${s.theme}`,
              `accent     ${accentName(s.accent)} (${s.accent})`,
              `wallpaper  ${wallpaperById(s.wallpaper).name}`,
              `terminal   ${s.terminalTheme}`,
              "",
              "usage: theme dark|light | theme accent <color> | theme wallpaper <name> | theme terminal <delta|matrix|amber|ice>",
              `colors: ${ACCENTS.map((a) => a.id).join(", ")}`,
              `wallpapers: ${WALLPAPERS.map((w) => w.id).join(", ")}`,
            ].join("\n");
          } else if (sub === "dark" || sub === "light") output = setTheme(sub);
          else if (sub === "toggle") output = setTheme(getState().settings.theme === "dark" ? "light" : "dark");
          else if (sub === "accent" || sub === "color") output = setAccent(val);
          else if (sub === "wallpaper" || sub === "wp") output = setWallpaper(val);
          else if (sub === "terminal") {
            if (!(val in THEMES)) throw new FsError(`theme: unknown terminal theme '${val}' (delta, matrix, amber, ice)`);
            output = setTerminalTheme(val as TerminalTheme);
          } else if (findWallpaper(sub)) output = setWallpaper(sub);
          else output = setAccent(sub);
          break;
        }
        case "open": {
          const target = pos[0];
          if (!target) throw new FsError("open: usage: open <app|path>");
          if (/^(https?:\/\/|www\.)/i.test(target)) {
            openApp("browser", { url: target });
            break;
          }
          if ((APP_IDS as string[]).includes(target.toLowerCase())) {
            openApp(target.toLowerCase() as AppId);
            break;
          }
          const p = abs(target);
          const n = getNode(fs(), p);
          if (!n) throw new FsError(`open: ${target}: No such file, directory or app`);
          if (n.type === "dir") openApp("files", { cwd: p });
          else openPath(p);
          break;
        }
        case "write":
        case "folio": {
          if (!pos[0]) {
            openApp("folio");
            break;
          }
          const p = abs(pos[0]);
          const n = getNode(fs(), p);
          if (n?.type === "dir") throw new FsError(`${cmd}: ${pos[0]}: Is a directory`);
          if (!n) setFs((r) => writeFile(r, p, ""));
          openApp("folio", { path: p });
          break;
        }
        case "browse":
        case "tesseract": {
          const q = pos.join(" ");
          openApp("browser", q ? { url: q } : {});
          if (q) output = `Opening ${q} in Tesseract…`;
          break;
        }
        case "edit":
        case "code":
        case "nano":
        case "vim": {
          if (!pos[0]) {
            openApp("editor");
            break;
          }
          const p = abs(pos[0]);
          const n = getNode(fs(), p);
          if (n?.type === "dir") throw new FsError(`${cmd}: ${pos[0]}: Is a directory`);
          if (!n) setFs((r) => writeFile(r, p, ""));
          openApp("editor", { path: p });
          break;
        }
        case "ask":
        case "claude": {
          const q = trimmed.replace(/^\S+\s*/, "");
          toggleAssistant(true);
          if (q) {
            void sendMessage(q);
            output = "✦ Sent to Claude — see the assistant panel.";
          }
          break;
        }
        case "neofetch":
        case "fastfetch":
          print({ kind: "node", node: <Neofetch user={user} accent={theme.prompt} /> });
          break;
        case "whoami":
          output = user;
          break;
        case "date":
          output = new Date().toString();
          break;
        case "uname":
          output = flags.has("a") ? "DeltaOS 1.0.0-aurora delta-vm x86_64 Delta/Electron" : "DeltaOS";
          break;
        case "history":
          output = [...hist, trimmed].map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join("\n");
          break;
        case "exit":
          closeWindow(win.id);
          break;
        case "sudo":
          output = `${user} is not in the sudoers file. This incident will be reported. 😉`;
          break;
        default:
          throw new FsError(`${cmd}: command not found. Type 'help' for a list of commands.`);
      }
      if (output !== null) {
        if (redirect) {
          const p = abs(redirect.path);
          const existing = getNode(fs(), p);
          const prev = redirect.append && existing?.type === "file" ? existing.content : "";
          setFs((r) => writeFile(r, p, prev + output + "\n"));
        } else if (output) out(output);
      }
    } catch (e) {
      err(e instanceof Error ? e.message : String(e));
      if (!(e instanceof FsError)) notify("Terminal error", String(e), "error");
    }
  };

  const complete = () => {
    const parts = input.split(/\s+/);
    const last = parts[parts.length - 1] ?? "";
    let candidates: string[];
    if (parts.length === 1) candidates = Object.keys(COMMANDS).filter((c) => c.startsWith(last));
    else if (parts[0] === "open" && !last.includes("/")) {
      candidates = [...APP_IDS.filter((a) => a.startsWith(last))];
      candidates.push(...pathCandidates(last));
    } else if (parts[0] === "theme" && parts.length === 2) candidates = ["dark", "light", "accent", "wallpaper", "terminal"].filter((c) => c.startsWith(last));
    else if (parts[0] === "theme" && parts[1] === "wallpaper") candidates = WALLPAPERS.map((w) => w.id).filter((c) => c.startsWith(last));
    else if (parts[0] === "theme" && parts[1] === "accent") candidates = ACCENTS.map((a) => a.id).filter((c) => c.startsWith(last));
    else if (parts[0] === "theme" && parts[1] === "terminal") candidates = Object.keys(THEMES).filter((c) => c.startsWith(last));
    else candidates = pathCandidates(last);
    if (candidates.length === 1) {
      parts[parts.length - 1] = candidates[0];
      setInput(parts.join(" ") + (candidates[0].endsWith("/") ? "" : " "));
    } else if (candidates.length > 1) {
      print({ kind: "cmd", text: input, cwd }, { kind: "out", text: candidates.join("   ") });
      const prefix = commonPrefix(candidates);
      if (prefix.length > last.length) {
        parts[parts.length - 1] = prefix;
        setInput(parts.join(" "));
      }
    }
  };

  const pathCandidates = (partial: string) => {
    const slash = partial.lastIndexOf("/");
    const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : "";
    const namePart = slash >= 0 ? partial.slice(slash + 1) : partial;
    const node = getNode(getState().fs, resolvePath(cwd, dirPart || "."));
    if (!node || node.type !== "dir") return [];
    return listDir(node)
      .filter(([n]) => n.startsWith(namePart) && (namePart.startsWith(".") || !n.startsWith(".")))
      .map(([n, e]) => dirPart + n + (e.type === "dir" ? "/" : ""));
  };

  const promptEl = (c: string) => (
    <span className="shrink-0 whitespace-pre">
      <span style={{ color: theme.prompt }} className="font-semibold">{user}@deltaos</span>
      <span style={{ color: theme.dim }}>:</span>
      <span style={{ color: theme.path }} className="font-semibold">{prettyPath(c)}</span>
      <span style={{ color: theme.dim }}>$ </span>
    </span>
  );

  return (
    <div
      className="absolute inset-0 font-mono text-[13px] leading-[1.55] flex flex-col"
      style={{ background: theme.bg, color: theme.fg }}
      onMouseUp={() => {
        if (!window.getSelection()?.toString()) inputRef.current?.focus();
      }}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 select-text">
        {lines.map((l) =>
          l.kind === "cmd" ? (
            <div key={l.id} className="flex flex-wrap">
              {promptEl(l.cwd!)}
              <span className="whitespace-pre-wrap break-all">{l.text}</span>
            </div>
          ) : l.kind === "node" ? (
            <div key={l.id} className="my-0.5">{l.node}</div>
          ) : (
            <div key={l.id} className="whitespace-pre-wrap break-words" style={{ color: l.kind === "err" ? "#fb7185" : undefined }}>
              {l.text}
            </div>
          ),
        )}
        <div className="flex">
          {promptEl(cwd)}
          <input
            ref={inputRef}
            autoFocus
            spellCheck={false}
            value={input}
            aria-label="Terminal input"
            onChange={(e) => {
              setInput(e.target.value);
              setHistIdx(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Stop the Enter from reaching an app this command opens and focuses.
                e.preventDefault();
                run(input);
                setInput("");
                setHistIdx(null);
              } else if (e.key === "Tab") {
                e.preventDefault();
                complete();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (!hist.length) return;
                const i = histIdx === null ? hist.length - 1 : Math.max(0, histIdx - 1);
                setHistIdx(i);
                setInput(hist[i]);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (histIdx === null) return;
                const i = histIdx + 1;
                if (i >= hist.length) {
                  setHistIdx(null);
                  setInput("");
                } else {
                  setHistIdx(i);
                  setInput(hist[i]);
                }
              } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
                e.preventDefault();
                setLines([]);
              } else if (e.ctrlKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
                e.preventDefault();
                print({ kind: "cmd", text: input + "^C", cwd });
                setInput("");
              }
            }}
            className="flex-1 min-w-0 bg-transparent outline-none border-none p-0"
            style={{ color: theme.fg, caretColor: theme.prompt }}
          />
        </div>
      </div>
    </div>
  );
}

function tokenize(s: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out.length ? out : [""];
}

function commonPrefix(xs: string[]) {
  let p = xs[0];
  for (const x of xs) while (!x.startsWith(p)) p = p.slice(0, -1);
  return p;
}

function Banner() {
  return (
    <div className="mb-2">
      <div className="font-semibold" style={{ color: "var(--os-accent)" }}>DeltaOS Terminal 1.0</div>
      <div style={{ opacity: 0.6 }}>Type <b>help</b> to see available commands, or <b>ask</b> to talk to Claude.</div>
    </div>
  );
}

function Neofetch({ user, accent }: { user: string; accent: string }) {
  const s = getState();
  const art = [
    "        ▲        ",
    "       ▲ ▲       ",
    "      ▲   ▲      ",
    "     ▲  ▲  ▲     ",
    "    ▲  ▲ ▲  ▲    ",
    "   ▲  ▲   ▲  ▲   ",
    "  ▲▲▲▲▲▲▲▲▲▲▲▲▲  ",
  ];
  const v = window.deltaos?.versions;
  const info: [string, string][] = [
    ["OS", "DeltaOS 1.0 \"Aurora\""],
    ["Kernel", "6.4.0-delta"],
    ["Shell", "dsh 1.0"],
    ["WM", "Glass Compositor"],
    ["Theme", `${s.settings.theme} · ${accentName(s.settings.accent)}`],
    ["Wallpaper", wallpaperById(s.settings.wallpaper).name],
    ["Runtime", v ? `Electron ${v.electron} · Chrome ${v.chrome}` : navigator.userAgent.split(" ").slice(-2).join(" ")],
    ["Resolution", `${window.screen.width}x${window.screen.height}`],
    ["Assistant", "Claude"],
  ];
  return (
    <div className="flex gap-6 my-1">
      <pre className="font-bold leading-[1.35]" style={{ color: accent }}>{art.join("\n")}</pre>
      <div>
        <div className="font-bold" style={{ color: accent }}>{user}@deltaos</div>
        <div style={{ opacity: 0.4 }}>{"-".repeat(user.length + 8)}</div>
        {info.map(([k, val]) => (
          <div key={k}>
            <span className="font-bold" style={{ color: accent }}>{k}</span>: {val}
          </div>
        ))}
        <div className="flex mt-1.5 gap-0">
          {["#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#e5e7eb"].map((c) => (
            <span key={c} className="w-5 h-3" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
