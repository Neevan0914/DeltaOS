import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FilePlus2, FolderOpen, Save, Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered, ListChecks, Quote, Minus, Link2,
  Type, PenLine, Columns2, BookOpen, Check, Code2,
} from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { getState, notify, setFs, updateSettings, useOS } from "../os/store";
import { openApp, updateWindow } from "../os/windows";
import { basename, dirname, extname, FsError, getNode, HOME, mkdir, prettyPath, resolvePath, writeFile } from "../os/vfs";
import { renderMarkdown } from "../lib/markdown";
import { isDocument } from "../os/open";
import { showContextMenu } from "../os/contextMenu";
import { Button, IconButton } from "../components/ui";
import { QuickOpen } from "../components/QuickOpen";

type View = "write" | "split" | "read";

const countWords = (s: string) => (s.match(/[\p{L}\p{N}’'-]+/gu) ?? []).length;

export function Folio({ win }: AppProps) {
  const fs = useOS((s) => s.fs);
  const prefs = useOS((s) => s.settings.folio);
  const [path, setPath] = useState<string | null>((win.props.path as string) ?? null);
  const [text, setText] = useState(() => {
    const n = path ? getNode(getState().fs, path) : null;
    return n?.type === "file" ? n.content : "";
  });
  const [saved, setSaved] = useState(text);
  const [view, setView] = useState<View>("write");
  const [saveAs, setSaveAs] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const name = path ? basename(path) : "Untitled";
  const markdown = !path || ["md", "markdown"].includes(extname(name));
  const dirty = text !== saved;
  const words = useMemo(() => countWords(text), [text]);
  const minutes = Math.max(1, Math.round(words / 230));

  useEffect(() => {
    updateWindow(win.id, { title: `${dirty ? "● " : ""}${name} — Folio` });
  }, [name, dirty, win.id]);

  useEffect(() => {
    const p = win.props.path as string | undefined;
    if (p && p !== path) load(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props.path]);

  // Saved documents autosave a moment after you stop typing.
  useEffect(() => {
    if (!path || !dirty) return;
    const t = setTimeout(() => save(path, true), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, path]);

  // Grow the page with its content.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [text, view, prefs.size, prefs.font, prefs.width]);

  const load = (p: string) => {
    const n = getNode(getState().fs, p);
    if (n?.type !== "file") return notify("Folio", `Can't open ${p}`, "error");
    setPath(p);
    setText(n.content);
    setSaved(n.content);
    setQuickOpen(false);
  };

  const save = (target = path, quiet = false) => {
    if (!target) {
      const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim().replace(/[\\/:*?"<>|]+/g, "").slice(0, 40);
      setSaveAs(`~/Documents/${title || "Untitled"}.md`);
      return;
    }
    try {
      setFs((r) => writeFile(mkdir(r, dirname(target), true), target, text));
      setPath(target);
      setSaved(text);
      setSaveAs(null);
      if (!quiet) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1400);
      }
    } catch (e) {
      notify("Couldn't save", e instanceof FsError ? e.message : String(e), "error");
    }
  };

  /* ---------------------------- formatting ---------------------------- */

  const edit = (fn: (sel: { start: number; end: number; value: string }) => { value: string; start: number; end: number }) => {
    const ta = taRef.current;
    if (!ta) return;
    const r = fn({ start: ta.selectionStart, end: ta.selectionEnd, value: ta.value });
    // Update the DOM synchronously so the selection is in place before the next keystroke.
    ta.focus();
    ta.value = r.value;
    ta.setSelectionRange(r.start, r.end);
    setText(r.value);
  };

  const wrap = (before: string, after = before, placeholder = "text") =>
    edit(({ start, end, value }) => {
      const sel = value.slice(start, end);
      if (sel && value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after) {
        return { value: value.slice(0, start - before.length) + sel + value.slice(end + after.length), start: start - before.length, end: end - before.length };
      }
      const inner = sel || placeholder;
      return { value: value.slice(0, start) + before + inner + after + value.slice(end), start: start + before.length, end: start + before.length + inner.length };
    });

  const prefixLines = (prefix: (i: number) => string, strip: RegExp) =>
    edit(({ start, end, value }) => {
      const ls = value.lastIndexOf("\n", start - 1) + 1;
      const le = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
      const lines = value.slice(ls, le).split("\n");
      const all = lines.every((l) => strip.test(l));
      const next = lines.map((l, i) => (all ? l.replace(strip, "") : prefix(i) + l.replace(strip, ""))).join("\n");
      return { value: value.slice(0, ls) + next + value.slice(le), start: ls + next.length, end: ls + next.length };
    });

  const LIST_RE = /^(\s*)([-*]\s+\[[ xX]\]\s+|[-*]\s+|\d+[.)]\s+|>\s?|#{1,6}\s+)/;
  const fmt = {
    h1: () => prefixLines(() => "# ", /^#{1,6}\s+/),
    h2: () => prefixLines(() => "## ", /^#{1,6}\s+/),
    bold: () => wrap("**", "**", "bold text"),
    italic: () => wrap("*", "*", "italic text"),
    strike: () => wrap("~~", "~~", "text"),
    bullet: () => prefixLines(() => "- ", LIST_RE),
    numbered: () => prefixLines((i) => `${i + 1}. `, LIST_RE),
    tasks: () => prefixLines(() => "- [ ] ", LIST_RE),
    quote: () => prefixLines(() => "> ", LIST_RE),
    divider: () => edit(({ start, value }) => ({ value: value.slice(0, start) + "\n\n---\n\n" + value.slice(start), start: start + 7, end: start + 7 })),
    link: () =>
      edit(({ start, end, value }) => {
        const label = value.slice(start, end) || "link text";
        const ins = `[${label}](https://)`;
        return { value: value.slice(0, start) + ins + value.slice(end), start: start + label.length + 3, end: start + label.length + 11 };
      }),
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === "s") {
      e.preventDefault();
      if (e.shiftKey) setSaveAs(path ? prettyPath(path) : "~/Documents/Untitled.md");
      else save();
    } else if (mod && k === "o") {
      e.preventDefault();
      setQuickOpen(true);
    } else if (mod && markdown && k === "b") {
      e.preventDefault();
      fmt.bold();
    } else if (mod && markdown && k === "i") {
      e.preventDefault();
      fmt.italic();
    } else if (mod && markdown && k === "k") {
      e.preventDefault();
      fmt.link();
    } else if (e.key === "Enter" && markdown) {
      // Continue lists and checklists; an empty item ends the list.
      const ta = e.currentTarget;
      const s = ta.selectionStart;
      const ls = text.lastIndexOf("\n", s - 1) + 1;
      const line = text.slice(ls, s);
      const m = line.match(/^(\s*)([-*]\s+\[[ xX]\]\s+|[-*]\s+|(\d+)([.)])\s+|>\s?)/);
      if (!m) return;
      e.preventDefault();
      if (line.trim() === m[0].trim()) {
        setText(text.slice(0, ls) + text.slice(s));
        requestAnimationFrame(() => ta.setSelectionRange(ls, ls));
        return;
      }
      const marker = m[3] ? `${Number(m[3]) + 1}${m[4]} ` : m[2].replace(/\[[xX]\]/, "[ ]");
      const ins = "\n" + m[1] + marker;
      setText(text.slice(0, s) + ins + text.slice(ta.selectionEnd));
      requestAnimationFrame(() => ta.setSelectionRange(s + ins.length, s + ins.length));
    }
  };

  const typographyMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const set = (p: Partial<typeof prefs>) => updateSettings({ folio: { ...getState().settings.folio, ...p } });
    showContextMenu({ clientX: r.right - 220, clientY: r.bottom + 6, preventDefault() {}, stopPropagation() {} }, [
      { label: "Serif", icon: prefs.font === "serif" ? Check : undefined, onClick: () => set({ font: "serif" }) },
      { label: "Sans serif", icon: prefs.font === "sans" ? Check : undefined, onClick: () => set({ font: "sans" }) },
      { label: "Monospace", icon: prefs.font === "mono" ? Check : undefined, onClick: () => set({ font: "mono" }) },
      { separator: true },
      { label: `Larger text (${prefs.size}px)`, shortcut: "A+", disabled: prefs.size >= 26, onClick: () => set({ size: prefs.size + 1 }) },
      { label: "Smaller text", shortcut: "A−", disabled: prefs.size <= 13, onClick: () => set({ size: prefs.size - 1 }) },
      { separator: true },
      { label: "Narrow page", icon: prefs.width === "narrow" ? Check : undefined, onClick: () => set({ width: "narrow" }) },
      { label: "Wide page", icon: prefs.width === "wide" ? Check : undefined, onClick: () => set({ width: "wide" }) },
    ]);
  };

  const onProseClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a[data-external]") as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    openApp("browser", { url: a.href });
  };

  const fontCls = prefs.font === "serif" ? "folio-serif" : prefs.font === "mono" ? "folio-mono" : "folio-sans";
  const pageW = prefs.width === "wide" ? 900 : 680;
  const effectiveView: View = markdown ? view : "write";

  const writer = (
    <div className="flex-1 min-w-0 overflow-y-auto" onPointerDown={(e) => e.target === e.currentTarget && taRef.current?.focus()}>
      <div className="mx-auto px-10 pt-12 pb-[40vh]" style={{ maxWidth: pageW }}>
        <textarea
          ref={taRef}
          value={text}
          autoFocus
          spellCheck
          aria-label="Document"
          placeholder={markdown ? "Start writing…  (# for a heading, - for a list, **bold**)" : "Start writing…"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className={`folio-page ${fontCls} w-full resize-none overflow-hidden bg-transparent outline-none text-fg placeholder:text-faint`}
          style={{ fontSize: prefs.size, lineHeight: 1.75 }}
        />
      </div>
    </div>
  );
  const reader = (
    <div className={`flex-1 min-w-0 overflow-y-auto ${effectiveView === "split" ? "border-l border-line bg-surface" : ""}`}>
      <div
        className={`mx-auto px-10 pt-12 pb-24 chat-md folio-prose ${fontCls}`}
        style={{ maxWidth: pageW, fontSize: prefs.size }}
        onClick={onProseClick}
        dangerouslySetInnerHTML={{ __html: text.trim() ? renderMarkdown(text) : `<p style="opacity:.45">Nothing to read yet.</p>` }}
      />
    </div>
  );

  return (
    <div className="absolute inset-0 flex flex-col text-fg">
      {/* Toolbar */}
      <div className="h-11 shrink-0 flex items-center gap-0.5 px-2.5 border-b border-line bg-surface">
        <IconButton title="New document" onClick={() => { setPath(null); setText(""); setSaved(""); requestAnimationFrame(() => taRef.current?.focus()); }}><FilePlus2 size={16} /></IconButton>
        <IconButton title="Open… (Ctrl+O)" onClick={() => setQuickOpen((v) => !v)}><FolderOpen size={16} /></IconButton>
        <IconButton title="Save (Ctrl+S)" onClick={() => save()}><Save size={16} /></IconButton>
        {markdown && effectiveView !== "read" && (
          // Keep focus (and the selection) in the page while clicking formatting buttons.
          <div className="contents" onMouseDown={(e) => e.preventDefault()}>
            <div className="w-px h-5 bg-line mx-1.5" />
            <IconButton title="Heading" onClick={fmt.h1}><Heading1 size={16} /></IconButton>
            <IconButton title="Subheading" onClick={fmt.h2}><Heading2 size={16} /></IconButton>
            <IconButton title="Bold (Ctrl+B)" onClick={fmt.bold}><Bold size={15} /></IconButton>
            <IconButton title="Italic (Ctrl+I)" onClick={fmt.italic}><Italic size={15} /></IconButton>
            <IconButton title="Strikethrough" onClick={fmt.strike}><Strikethrough size={15} /></IconButton>
            <div className="w-px h-5 bg-line mx-1.5" />
            <IconButton title="Bulleted list" onClick={fmt.bullet}><List size={16} /></IconButton>
            <IconButton title="Numbered list" onClick={fmt.numbered}><ListOrdered size={16} /></IconButton>
            <IconButton title="Checklist" onClick={fmt.tasks}><ListChecks size={16} /></IconButton>
            <IconButton title="Quote" onClick={fmt.quote}><Quote size={15} /></IconButton>
            <IconButton title="Divider" onClick={fmt.divider}><Minus size={16} /></IconButton>
            <IconButton title="Link (Ctrl+K)" onClick={fmt.link}><Link2 size={15} /></IconButton>
          </div>
        )}
        <div className="flex-1" />
        {markdown && (
          <div className="inline-flex p-0.5 rounded-lg bg-input border border-line mr-1">
            {([
              ["write", PenLine, "Write"],
              ["split", Columns2, "Split"],
              ["read", BookOpen, "Read"],
            ] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                title={label}
                onClick={() => setView(v)}
                className={`h-6 px-2 rounded-md flex items-center gap-1 text-[11.5px] font-medium transition-colors ${view === v ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        )}
        <IconButton title="Typography" onClick={typographyMenu}><Type size={16} /></IconButton>
      </div>

      {saveAs !== null && (
        <form
          className="flex items-center gap-2 px-3 py-2 border-b border-line bg-accent/10 anim-pop-down"
          onSubmit={(e) => {
            e.preventDefault();
            save(resolvePath(HOME, saveAs));
          }}
        >
          <span className="text-[12.5px] text-muted shrink-0">Save as</span>
          <input autoFocus value={saveAs} onChange={(e) => setSaveAs(e.target.value)} className="os-input flex-1 !h-8 !py-0 !text-[12.5px]" onKeyDown={(e) => e.key === "Escape" && setSaveAs(null)} />
          <Button variant="accent" type="submit">Save</Button>
          <Button type="button" onClick={() => setSaveAs(null)}>Cancel</Button>
        </form>
      )}

      <div className="relative flex-1 min-h-0 flex">
        {effectiveView !== "read" && writer}
        {effectiveView !== "write" && reader}
        {quickOpen && <QuickOpen fs={fs} onPick={load} onClose={() => setQuickOpen(false)} filter={isDocument} placeholder="Open a document…" />}
      </div>

      {/* Status bar */}
      <div className="h-8 shrink-0 flex items-center gap-4 px-4 border-t border-line text-[11.5px] text-muted">
        <span>{words.toLocaleString()} {words === 1 ? "word" : "words"}</span>
        <span>{text.length.toLocaleString()} characters</span>
        <span>{minutes} min read</span>
        <div className="flex-1" />
        <span>{markdown ? "Markdown" : "Plain text"}</span>
        <span className="flex items-center gap-1.5">
          {!path ? (
            "Not saved"
          ) : dirty ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Editing…
            </>
          ) : (
            <>
              <Check size={12} className={savedFlash ? "text-emerald-400" : ""} /> Saved{path ? ` · ${prettyPath(dirname(path))}` : ""}
            </>
          )}
        </span>
        {path && !markdown && (
          <button className="hover:text-fg flex items-center gap-1" onClick={() => openApp("editor", { path })} title="Open in Code">
            <Code2 size={12} /> Code
          </button>
        )}
      </div>
    </div>
  );
}
