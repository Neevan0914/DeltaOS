import { useSyncExternalStore } from "react";
import { z } from "zod";
import type { ClaudeMessage, ClaudeResponse, ClaudeStatus, ClaudeTool } from "../../shared/ipc";
import { APP_IDS, findWallpaper, notify, setAccent, setTerminalTheme, setTheme, setWallpaper, systemSnapshot } from "./actions";
import { getState, setFs, setState, updateSettings, type AppId } from "./store";
import { closeApp, openApp } from "./windows";
import { ACCENTS } from "./theme";
import { WALLPAPERS } from "./wallpapers";
import { FsError, getNode, HOME, listDir, mkdir, nodeSize, resolvePath, writeFile } from "./vfs";
import { APPS } from "../apps/registry";
import { toUrl } from "./open";

/* --------------------------------- state -------------------------------- */

export interface ToolChip {
  name: string;
  label: string;
  ok: boolean;
}
export interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  tools: ToolChip[];
  streaming?: boolean;
  offline?: boolean;
}
interface AssistantState {
  messages: ChatMsg[];
  busy: boolean;
  status: ClaudeStatus | null;
}

let st: AssistantState = { messages: [], busy: false, status: null };
const subs = new Set<() => void>();
const set = (patch: Partial<AssistantState>) => {
  st = { ...st, ...patch };
  subs.forEach((s) => s());
};
const patchMsg = (id: string, fn: (m: ChatMsg) => ChatMsg) => set({ messages: st.messages.map((m) => (m.id === id ? fn(m) : m)) });

export function useAssistant() {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => st,
  );
}

export async function refreshStatus() {
  const status = window.deltaos ? await window.deltaos.claude.status() : null;
  set({ status });
  return status;
}

let history: ClaudeMessage[] = [];
let seq = 0;
const mid = () => `m${++seq}-${Date.now().toString(36)}`;
let currentRequest: string | null = null;

export function clearChat() {
  if (st.busy) return;
  history = [];
  set({ messages: [] });
}

export function stopGenerating() {
  if (currentRequest) window.deltaos?.claude.abort(currentRequest);
}

export function toggleAssistant(open?: boolean) {
  setState((s) => ({ assistantOpen: open ?? !s.assistantOpen, startOpen: false }));
}

/* --------------------------------- tools -------------------------------- */

const appEnum = z.enum(APP_IDS as [AppId, ...AppId[]]);
const wallpaperEnum = z.enum(WALLPAPERS.map((w) => w.id) as [string, ...string[]]);

interface ToolDef<S extends z.ZodType> {
  description: string;
  schema: S;
  run: (input: z.infer<S>) => unknown;
  label: (input: z.infer<S>) => string;
}
const tool = <S extends z.ZodType>(d: ToolDef<S>) => d;

const fsPath = (p: string) => resolvePath(HOME, p);

const TOOLS = {
  get_system_state: tool({
    description:
      "Read the current DeltaOS state: theme, accent color, wallpaper, preferences, open windows, the lists of available wallpapers and accent colors, and the local time. Call this before answering questions about the current setup.",
    schema: z.object({}),
    run: () => systemSnapshot(),
    label: () => "Read system state",
  }),
  set_theme: tool({
    description: "Switch DeltaOS between dark and light mode.",
    schema: z.object({ mode: z.enum(["dark", "light"]).describe("The color scheme to apply") }),
    run: ({ mode }) => setTheme(mode),
    label: ({ mode }) => `Theme → ${mode}`,
  }),
  set_accent_color: tool({
    description: `Set the system accent color. Use a preset (${ACCENTS.map((a) => a.id).join(", ")}) or any 6-digit hex color such as #ff8800.`,
    schema: z.object({ color: z.string().describe("Preset name or hex color") }),
    run: ({ color }) => setAccent(color),
    label: ({ color }) => `Accent → ${color}`,
  }),
  set_wallpaper: tool({
    description: `Change the desktop wallpaper. Available: ${WALLPAPERS.map((w) => `${w.id} (${w.name})`).join(", ")}.`,
    schema: z.object({ wallpaper: wallpaperEnum.describe("Wallpaper id") }),
    run: ({ wallpaper }) => setWallpaper(wallpaper),
    label: ({ wallpaper }) => `Wallpaper → ${findWallpaper(wallpaper)?.name ?? wallpaper}`,
  }),
  update_preferences: tool({
    description: "Change other system preferences. Only include the fields you want to change.",
    schema: z.object({
      transparency: z.boolean().optional().describe("Frosted-glass transparency effects"),
      animations: z.boolean().optional().describe("Window and UI animations"),
      clock_24h: z.boolean().optional().describe("Show the clock in 24-hour format"),
      terminal_theme: z.enum(["delta", "matrix", "amber", "ice"]).optional().describe("Terminal color scheme"),
    }),
    run: (p) => {
      const changes: string[] = [];
      if (p.transparency !== undefined) {
        updateSettings({ transparency: p.transparency });
        changes.push(`transparency ${p.transparency ? "on" : "off"}`);
      }
      if (p.animations !== undefined) {
        updateSettings({ animations: p.animations });
        changes.push(`animations ${p.animations ? "on" : "off"}`);
      }
      if (p.clock_24h !== undefined) {
        updateSettings({ clock24: p.clock_24h });
        changes.push(`${p.clock_24h ? "24" : "12"}-hour clock`);
      }
      if (p.terminal_theme) changes.push(setTerminalTheme(p.terminal_theme));
      return changes.length ? `Updated: ${changes.join(", ")}.` : "Nothing to change.";
    },
    label: () => "Updated preferences",
  }),
  open_app: tool({
    description: `Open an application window. Apps: ${APP_IDS.map((a) => `${a} (${APPS[a].title})`).join(", ")}. "folio" is the writing app for documents (.md, .txt); "editor" (Code) is for source code; "browser" is the Tesseract web browser; "games" shows the games by Anyware Studios (the user's itch.io page). For "editor", "folio" or "files" you may pass a path to open.`,
    schema: z.object({
      app: appEnum,
      path: z.string().optional().describe("Optional file (editor/folio) or folder (files) path, e.g. ~/Documents/notes.txt"),
    }),
    run: ({ app, path }) => {
      if (path) {
        const p = fsPath(path);
        const node = getNode(getState().fs, p);
        if (!node) throw new FsError(`No such file or directory: ${p}`);
        if (app === "files" && node.type !== "dir") throw new FsError(`Not a folder: ${p}`);
        if ((app === "editor" || app === "folio") && node.type !== "file") throw new FsError(`Not a file: ${p}`);
        openApp(app, app === "files" ? { cwd: p } : { path: p });
      } else openApp(app);
      return `Opened ${APPS[app].title}.`;
    },
    label: ({ app }) => `Opened ${APPS[app]?.title ?? app}`,
  }),
  open_url: tool({
    description: "Open a web page in the Tesseract browser. Accepts a full URL, a domain like example.com, or search words (searched with the user's search engine).",
    schema: z.object({ url: z.string().describe("URL, domain, or search query") }),
    run: ({ url }) => {
      const target = toUrl(url, getState().settings.browser.search);
      openApp("browser", { url: target });
      return `Opened ${target} in Tesseract.`;
    },
    label: ({ url }) => `Opened ${url.replace(/^https?:\/\//, "").slice(0, 40)}`,
  }),
  close_app: tool({
    description: "Close every open window of an application.",
    schema: z.object({ app: appEnum }),
    run: ({ app }) => {
      closeApp(app);
      return `Closed ${APPS[app].title}.`;
    },
    label: ({ app }) => `Closed ${APPS[app]?.title ?? app}`,
  }),
  list_directory: tool({
    description: "List a folder in the virtual filesystem. The home folder is ~ (/home/user).",
    schema: z.object({ path: z.string().describe("Folder path, e.g. ~ or ~/Documents") }),
    run: ({ path }) => {
      const node = getNode(getState().fs, fsPath(path));
      if (!node) throw new FsError(`No such directory: ${path}`);
      if (node.type !== "dir") throw new FsError(`Not a directory: ${path}`);
      return listDir(node).map(([name, n]) => ({ name, type: n.type, size: nodeSize(n) }));
    },
    label: ({ path }) => `Listed ${path}`,
  }),
  read_file: tool({
    description: "Read a text file from the virtual filesystem.",
    schema: z.object({ path: z.string() }),
    run: ({ path }) => {
      const node = getNode(getState().fs, fsPath(path));
      if (!node) throw new FsError(`No such file: ${path}`);
      if (node.type !== "file") throw new FsError(`Is a directory: ${path}`);
      return node.content;
    },
    label: ({ path }) => `Read ${path}`,
  }),
  write_file: tool({
    description: "Create or overwrite a text file in the virtual filesystem. Missing parent folders are created.",
    schema: z.object({ path: z.string(), content: z.string() }),
    run: ({ path, content }) => {
      const p = fsPath(path);
      const parent = p.split("/").slice(0, -1).join("/") || "/";
      setFs((fs) => writeFile(mkdir(fs, parent, true), p, content));
      return `Wrote ${content.length} characters to ${p}.`;
    },
    label: ({ path }) => `Saved ${path}`,
  }),
  create_folder: tool({
    description: "Create a folder (and any missing parents) in the virtual filesystem.",
    schema: z.object({ path: z.string() }),
    run: ({ path }) => {
      setFs((fs) => mkdir(fs, fsPath(path), true));
      return `Created ${fsPath(path)}.`;
    },
    label: ({ path }) => `Created ${path}`,
  }),
  send_notification: tool({
    description: "Show a desktop notification toast to the user.",
    schema: z.object({ title: z.string(), message: z.string() }),
    run: ({ title, message }) => {
      notify(title, message, "ai");
      return "Notification shown.";
    },
    label: () => "Sent notification",
  }),
};
type ToolName = keyof typeof TOOLS;

const TOOL_DEFS: ClaudeTool[] = (Object.entries(TOOLS) as [ToolName, ToolDef<z.ZodType>][]).map(([name, d]) => {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(d.schema) as Record<string, unknown>;
  return {
    name,
    description: d.description,
    input_schema: { type: "object", ...schema } as ClaudeTool["input_schema"],
    eager_input_streaming: true,
  };
});

const SYSTEM = `You are Claude, the built-in AI assistant of DeltaOS, a simulated desktop operating system running as a desktop app.

You can answer general questions, and you can operate the OS with your tools: change the theme, accent color, wallpaper and other preferences, open and close apps, and read, write and organise files in the virtual filesystem (home folder: ~ = /home/user, with Desktop, Documents, Code, Pictures and Downloads).

Guidelines:
- When the user asks for a change, make it with the tools, then confirm in one short sentence. Don't ask for confirmation for harmless, reversible changes like themes and wallpapers.
- When a request is vague ("make it cozy", "something more vibrant"), pick sensible values yourself and say what you chose.
- Check the current setup with get_system_state when the answer depends on it.
- Keep replies short and friendly. Use light markdown (bold, lists, inline code) only when it helps.
- Built-in apps: Files, Tesseract (web browser), Games (the user's Anyware Studios games on itch.io), Terminal (commands: help, ls, cd, cat, mkdir, clear, theme, …), Code (code editor for Python, C++, HTML, JavaScript, TypeScript and C#; it can run JavaScript/TypeScript and preview HTML), Folio (writing app for Markdown and text documents), Settings, Calculator, About. The keyboard shortcut to open you is Ctrl+Space.
- Put prose (notes, letters, lists) in .md files so they open in Folio; put programs in source files with the right extension so they open in Code.`;

function runTool(name: string, input: unknown): { content: string; ok: boolean; label: string } {
  const def = (TOOLS as Record<string, ToolDef<z.ZodType>>)[name];
  if (!def) return { content: `Unknown tool: ${name}`, ok: false, label: name };
  const parsed = def.schema.safeParse(input ?? {});
  if (!parsed.success) {
    return { content: `INVALID_INPUT: ${parsed.error.message}. Received: ${JSON.stringify(input)}`, ok: false, label: name };
  }
  try {
    const result = def.run(parsed.data);
    return { content: typeof result === "string" ? result : JSON.stringify(result), ok: true, label: def.label(parsed.data) };
  } catch (e) {
    return { content: e instanceof Error ? e.message : String(e), ok: false, label: def.label(parsed.data) };
  }
}

/* ------------------------------- agent loop ------------------------------ */

export async function sendMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed || st.busy) return;
  set({
    busy: true,
    messages: [...st.messages, { id: mid(), role: "user", text: trimmed, tools: [] }],
  });
  try {
    const status = st.status ?? (await refreshStatus());
    if (!window.deltaos || !status?.configured) {
      await offlineReply(trimmed);
      return;
    }
    await claudeReply(trimmed);
  } finally {
    set({ busy: false });
    currentRequest = null;
  }
}

async function claudeReply(text: string) {
  const bridge = window.deltaos!;
  const checkpoint = history.length;
  history.push({ role: "user", content: text });
  const msgId = mid();
  set({ messages: [...st.messages, { id: msgId, role: "assistant", text: "", tools: [], streaming: true }] });

  // Streamed text is buffered per model turn. IPC delta events may arrive after the turn's
  // reply, so once a turn completes its text is taken from the final message instead.
  const stepText: string[] = [];
  const finalized = new Set<number>();
  const render = () => patchMsg(msgId, (m) => ({ ...m, text: stepText.filter((t) => t?.trim()).map((t) => t.trim()).join("\n\n") }));
  const unsub = bridge.claude.onDelta((d) => {
    if (!d.requestId.startsWith(msgId + "-")) return;
    const step = Number(d.requestId.slice(msgId.length + 1));
    if (finalized.has(step)) return;
    stepText[step] = (stepText[step] ?? "") + d.text;
    render();
  });
  try {
    for (let step = 0; step < 12; step++) {
      const requestId = `${msgId}-${step}`;
      currentRequest = requestId;
      const res = await bridge.claude.turn({ requestId, system: SYSTEM, tools: TOOL_DEFS, messages: history });
      finalized.add(step);
      if (!res.ok) {
        history.length = checkpoint; // roll back this exchange so the conversation stays valid
        if (res.kind === "no_key") {
          set({ messages: st.messages.filter((m) => m.id !== msgId) });
          await refreshStatus();
          await offlineReply(text);
          return;
        }
        if (res.kind !== "aborted") pushError(res.error);
        return;
      }
      const msg: ClaudeResponse = res.message;
      history.push({ role: "assistant", content: msg.content });
      stepText[step] = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      render();

      if (msg.stop_reason === "refusal") {
        stepText[step] = (stepText[step] ?? "") + "\n\nI can't help with that request.";
        render();
        break;
      }
      if (msg.stop_reason === "pause_turn") continue;
      const toolUses = msg.content.filter((b) => b.type === "tool_use");
      if (msg.stop_reason !== "tool_use" || toolUses.length === 0) {
        // A turn cut off mid tool call (e.g. max_tokens) must not leave an unanswered tool_use behind.
        if (toolUses.length) history.pop();
        break;
      }

      const results = toolUses.map((b) => {
        const r = runTool(b.name, b.input);
        patchMsg(msgId, (m) => ({ ...m, tools: [...m.tools, { name: b.name, label: r.label, ok: r.ok }] }));
        return { type: "tool_result" as const, tool_use_id: b.id, content: r.content, is_error: !r.ok || undefined };
      });
      history.push({ role: "user", content: results });
    }
  } finally {
    unsub();
    patchMsg(msgId, (m) => ({ ...m, streaming: false }));
  }
}

function pushError(text: string) {
  set({ messages: [...st.messages, { id: mid(), role: "error", text, tools: [] }] });
}

/* ---------------------------- offline assistant --------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A small rule-based assistant used when no Claude API key is configured. */
async function offlineReply(text: string) {
  const q = text.toLowerCase();
  const tools: ToolChip[] = [];
  const replies: string[] = [];
  const act = (name: string, input: unknown) => {
    const r = runTool(name, input);
    tools.push({ name, label: r.label, ok: r.ok });
    if (!r.ok) replies.push(r.content);
    return r.ok;
  };

  if (/\b(dark|night)\b/.test(q) && /(mode|theme|dark)/.test(q)) act("set_theme", { mode: "dark" });
  else if (/\b(light|day|bright)\b/.test(q) && /(mode|theme|light)/.test(q)) act("set_theme", { mode: "light" });

  const wp = WALLPAPERS.find((w) => q.includes(w.id) || q.includes(w.name.toLowerCase()));
  if (wp && /(wallpaper|background|desktop|wall)/.test(q)) act("set_wallpaper", { wallpaper: wp.id });
  else if (/(wallpaper|background)/.test(q) && /(random|another|different|change|new|surprise)/.test(q)) {
    const others = WALLPAPERS.filter((w) => w.id !== getState().settings.wallpaper);
    act("set_wallpaper", { wallpaper: others[Math.floor(Math.random() * others.length)].id });
  }

  const accentWords = ["violet", "purple", "blue", "cyan", "teal", "emerald", "green", "amber", "yellow", "orange", "rose", "red", "pink"];
  const hex = q.match(/#[0-9a-f]{6}\b/)?.[0];
  const accentWord = accentWords.find((c) => new RegExp(`\\b${c}\\b`).test(q));
  if ((/(accent|colou?r|highlight)/.test(q) || (!wp && accentWord)) && (hex || accentWord)) act("set_accent_color", { color: hex ?? accentWord });

  const toggle = (key: string, re: RegExp) => {
    if (!re.test(q)) return;
    const off = /\b(off|disable|no|stop|remove|reduce)\b/.test(q);
    act("update_preferences", { [key]: !off });
  };
  toggle("transparency", /(transparen|glass|blur)/);
  toggle("animations", /animation/);
  if (/24.?h(our)?/.test(q)) act("update_preferences", { clock_24h: !/\b(off|disable|12)\b/.test(q) });

  const appWords: Record<string, AppId> = {
    terminal: "terminal", shell: "terminal", console: "terminal", files: "files", explorer: "files", finder: "files", folder: "files",
    editor: "editor", code: "editor", ide: "editor", folio: "folio", notepad: "folio", writer: "folio", notes: "folio",
    games: "games", game: "games", itch: "games", play: "games",
    browser: "browser", tesseract: "browser", web: "browser", internet: "browser", settings: "settings", preferences: "settings",
    calculator: "calculator", calc: "calculator", about: "about",
  };
  const verbOpen = /\b(open|launch|start|run|show|play)\b/.test(q);
  const verbClose = /\b(close|quit|exit|kill)\b/.test(q);
  if (verbOpen || verbClose) {
    for (const [word, app] of Object.entries(appWords)) {
      if (new RegExp(`\\b${word}\\b`).test(q) && !tools.some((t) => t.name.endsWith("_app") && t.label.includes(APPS[app].title))) {
        act(verbClose ? "close_app" : "open_app", { app });
      }
    }
  }

  // "go to github.com", "search the web for cats", "look up rust traits"
  const site = text.match(/\b(?:go to|visit|open|browse(?: to)?)\s+((?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+\S*)/i)?.[1];
  const search = text.match(/\b(?:search(?: the web| online| google)?(?: for)?|look up|google)\s+(.+)/i)?.[1];
  if (site) act("open_url", { url: site });
  else if (search && !tools.length) act("open_url", { url: search.replace(/[?.!]+$/, "") });

  await sleep(350);
  let reply: string;
  if (tools.length) {
    reply = replies.length ? replies.join(" ") : `Done — ${tools.map((t) => t.label.toLowerCase()).join(", ")}.`;
  } else if (/\b(time|date|day)\b/.test(q)) {
    reply = `It's **${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}** on ${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}.`;
  } else if (/\b(hi|hello|hey|yo)\b/.test(q)) {
    reply = `Hi ${getState().settings.username.split(" ")[0]}! I can change your theme, wallpaper and accent color, or open apps. Try *"light mode with the sunset wallpaper"*.`;
  } else {
    reply = `I'm running in **offline mode**, so I can only handle system commands right now — for example:
- "switch to light mode"
- "use the nebula wallpaper and a pink accent"
- "open the terminal" / "turn off transparency"

To chat about anything, add your Anthropic API key in **Settings → Claude AI**.`;
  }
  set({ messages: [...st.messages, { id: mid(), role: "assistant", text: reply, tools, offline: true }] });
}
