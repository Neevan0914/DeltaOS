import { useEffect, useMemo, useRef, useState } from "react";
import { Save, FilePlus2, FolderOpen, WrapText, Eye, Check, ChevronDown, Play, Square, Trash2, X, Feather, Code2 } from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { getState, notify, setFs, useOS } from "../os/store";
import { openApp, updateWindow } from "../os/windows";
import { basename, dirname, FsError, getNode, HOME, mkdir, prettyPath, resolvePath, writeFile } from "../os/vfs";
import { CODE_LANGUAGES, highlight, languageOf, LANGUAGE_LABEL, TEMPLATES, type CodeLanguage } from "../lib/highlight";
import { renderMarkdown } from "../lib/markdown";
import { showContextMenu } from "../os/contextMenu";
import { isDocument } from "../os/open";
import { Button, IconButton } from "../components/ui";
import { FileGlyph } from "../lib/fileIcons";
import { QuickOpen } from "../components/QuickOpen";
import { buildRunDocument, CodeRunner, HtmlPreview, type OutputLine } from "./CodeRunner";

const LANG_COLORS: Record<string, string> = { py: "#3b82f6", cpp: "#0ea5e9", html: "#f97316", js: "#eab308", ts: "#3178c6", cs: "#a855f7" };

interface Run {
  id: number;
  html: string;
  lineOffset: number;
  lang: string;
  started: number;
}

export function Editor({ win }: AppProps) {
  const fs = useOS((s) => s.fs);
  const focused = useOS((s) => s.focusedId === win.id);
  const initialLang = (win.props.lang as CodeLanguage | undefined) ?? "py";
  const [path, setPath] = useState<string | null>((win.props.path as string) ?? null);
  const fileNode = path ? getNode(fs, path) : null;
  const [text, setText] = useState(() => (fileNode?.type === "file" ? fileNode.content : path ? "" : TEMPLATES[initialLang]));
  const [saved, setSaved] = useState(() => (path ? text : ""));
  const [langOverride, setLangOverride] = useState<string | null>(path ? null : initialLang);
  const [wrap, setWrap] = useState(false);
  const [preview, setPreview] = useState(() => (path ? ["md", "html"].includes(languageOf(path)) : false));
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [saveAs, setSaveAs] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [output, setOutput] = useState<OutputLine[] | null>(null);
  const [running, setRunning] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const outRef = useRef<HTMLDivElement>(null);

  const name = path ? basename(path) : "Untitled";
  const lang = langOverride ?? languageOf(name);
  const dirty = text !== saved;
  const canRun = lang === "js" || lang === "ts";
  const canPreview = lang === "md" || lang === "html";

  useEffect(() => {
    updateWindow(win.id, { title: `${dirty ? "● " : ""}${name} — Code` });
  }, [name, dirty, win.id]);

  // React to "open this file" requests targeted at this window
  useEffect(() => {
    const p = win.props.path as string | undefined;
    if (p && p !== path) loadFile(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props.path]);

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [output]);

  const loadFile = (p: string) => {
    const n = getNode(getState().fs, p);
    if (n?.type !== "file") return notify("Code", `Can't open ${p}`, "error");
    setPath(p);
    setText(n.content);
    setSaved(n.content);
    setLangOverride(null);
    setPreview(["md", "html"].includes(languageOf(p)));
    setQuickOpen(false);
  };

  const newFile = (l: CodeLanguage) => {
    setPath(null);
    setText(TEMPLATES[l]);
    setSaved("");
    setLangOverride(l);
    setPreview(l === "html");
    stopRun();
    setOutput(null);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  /** Switch the language mode. An untitled buffer that is empty or still a starter template gets the new template. */
  const switchLanguage = (l: CodeLanguage) => {
    const pristine = !path && (!text.trim() || Object.values(TEMPLATES).some((t) => t.trim() === text.trim()));
    setLangOverride(path && languageOf(name) === l ? null : l);
    if (pristine) setText(TEMPLATES[l]);
    if (l === "html") setPreview(true);
    if (l !== "js" && l !== "ts") {
      stopRun();
      setOutput(null);
    }
  };

  const extFor = (l: string) => CODE_LANGUAGES.find((c) => c.id === l)?.ext ?? "txt";

  const save = (target = path) => {
    if (!target) {
      setSaveAs(`~/Code/untitled.${extFor(lang)}`);
      return;
    }
    try {
      setFs((r) => writeFile(mkdir(r, dirname(target), true), target, text));
      setPath(target);
      setSaved(text);
      setSaveAs(null);
      if (languageOf(basename(target)) !== "txt") setLangOverride(null);
    } catch (e) {
      notify("Couldn't save", e instanceof FsError ? e.message : String(e), "error");
    }
  };

  const startRun = () => {
    if (!canRun) return;
    try {
      const { html, lineOffset } = buildRunDocument(text, lang as "js" | "ts");
      setOutput([{ kind: "system", text: `▶ Running ${name} (${LANGUAGE_LABEL[lang]})` }]);
      setRun({ id: Date.now(), html, lineOffset, lang, started: performance.now() });
      setRunning(true);
    } catch (e) {
      setOutput([{ kind: "error", text: `Compile error: ${e instanceof Error ? e.message : String(e)}` }]);
      setRun(null);
    }
  };
  function stopRun() {
    setRun(null);
    setRunning(false);
  }

  const lines = useMemo(() => text.split("\n").length, [text]);
  const html = useMemo(() => highlight(text, lang) + "\n ", [text, lang]);
  const [previewDoc, setPreviewDoc] = useState(text);
  useEffect(() => {
    const t = setTimeout(() => setPreviewDoc(text), 350);
    return () => clearTimeout(t);
  }, [text]);

  const updateCursor = () => {
    const ta = taRef.current;
    if (!ta) return;
    const ls = ta.value.slice(0, ta.selectionStart).split("\n");
    setCursor({ line: ls.length, col: ls[ls.length - 1].length + 1 });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (e.shiftKey) setSaveAs(path ? prettyPath(path) : `~/Code/untitled.${extFor(lang)}`);
      else save();
      return;
    }
    if (mod && e.key.toLowerCase() === "o") {
      e.preventDefault();
      setQuickOpen(true);
      return;
    }
    if (mod && e.key === "Enter") {
      e.preventDefault();
      startRun();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end } = ta;
      const indent = lang === "py" || lang === "cs" || lang === "cpp" ? "    " : "  ";
      setText(text.slice(0, s) + indent + text.slice(end));
      requestAnimationFrame(() => ta.setSelectionRange(s + indent.length, s + indent.length));
    } else if (e.key === "Enter") {
      const s = ta.selectionStart;
      const lineStart = text.lastIndexOf("\n", s - 1) + 1;
      const indent = text.slice(lineStart, s).match(/^\s*/)?.[0] ?? "";
      const unit = lang === "py" || lang === "cs" || lang === "cpp" ? "    " : "  ";
      const extra = /[{[(:]\s*$/.test(text.slice(lineStart, s)) ? unit : "";
      if (indent || extra) {
        e.preventDefault();
        const ins = "\n" + indent + extra;
        setText(text.slice(0, s) + ins + text.slice(ta.selectionEnd));
        requestAnimationFrame(() => ta.setSelectionRange(s + ins.length, s + ins.length));
      }
    }
  };

  const languageMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    showContextMenu({ clientX: r.left, clientY: r.bottom + 6, preventDefault() {}, stopPropagation() {} }, [
      ...CODE_LANGUAGES.map((l) => ({
        label: l.label,
        icon: lang === l.id ? Check : undefined,
        shortcut: `.${l.ext}`,
        onClick: () => switchLanguage(l.id),
      })),
    ]);
  };
  const newMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    showContextMenu({ clientX: r.left, clientY: r.bottom + 6, preventDefault() {}, stopPropagation() {} }, [
      ...CODE_LANGUAGES.map((l) => ({ label: `New ${l.label} file`, icon: Code2, onClick: () => newFile(l.id) })),
      { separator: true },
      { label: "New document in Folio", icon: Feather, onClick: () => openApp("folio") },
    ]);
  };

  const layerStyle: React.CSSProperties = wrap ? { whiteSpace: "pre-wrap", wordBreak: "break-word" } : {};
  const showPreview = preview && canPreview;

  return (
    <div className="absolute inset-0 flex flex-col text-fg">
      {/* Toolbar */}
      <div className="h-11 shrink-0 flex items-center gap-1 px-2.5 border-b border-line bg-surface">
        <IconButton title="New file" onClick={newMenu}><FilePlus2 size={16} /></IconButton>
        <IconButton title="Open… (Ctrl+O)" onClick={() => setQuickOpen((v) => !v)}><FolderOpen size={16} /></IconButton>
        <IconButton title="Save (Ctrl+S)" onClick={() => save()}><Save size={16} /></IconButton>
        <div className="w-px h-5 bg-line mx-1" />
        <div className="flex items-center gap-2 min-w-0 px-1">
          <FileGlyph name={path ? name : `x.${extFor(lang)}`} node={{ type: "file", content: "", mtime: 0 }} size={20} />
          <span className="text-[13px] font-medium truncate">{name}</span>
          {dirty ? <span className="w-2 h-2 rounded-full bg-accent shrink-0" title="Unsaved changes" /> : path && <Check size={14} className="text-emerald-400 shrink-0" />}
          <span className="text-[11.5px] text-faint truncate">{path ? prettyPath(dirname(path)) : "not saved"}</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={languageMenu}
          data-language-picker
          title="Change language"
          className="h-7 pl-2 pr-1.5 mr-1 rounded-lg border border-line bg-input hover:border-accent/60 flex items-center gap-1.5 text-[12px] font-medium transition-colors"
        >
          <span className="w-2 h-2 rounded-full" style={{ background: LANG_COLORS[lang] ?? "var(--os-muted)" }} />
          {LANGUAGE_LABEL[lang] ?? lang}
          <ChevronDown size={13} className="text-muted" />
        </button>
        {canRun &&
          (running ? (
            <Button className="!h-7 !px-2.5 mr-1" onClick={stopRun} title="Stop">
              <Square size={11} fill="currentColor" /> Stop
            </Button>
          ) : (
            <Button variant="accent" className="!h-7 !px-2.5 mr-1" onClick={startRun} title="Run (Ctrl+Enter)">
              <Play size={12} fill="currentColor" /> Run
            </Button>
          ))}
        <IconButton title="Word wrap" active={wrap} onClick={() => setWrap((w) => !w)}><WrapText size={16} /></IconButton>
        {canPreview && <IconButton title="Preview" active={preview} onClick={() => setPreview((p) => !p)}><Eye size={16} /></IconButton>}
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
          <input autoFocus value={saveAs} onChange={(e) => setSaveAs(e.target.value)} className="os-input flex-1 !h-8 !py-0 font-mono !text-[12.5px]" onKeyDown={(e) => e.key === "Escape" && setSaveAs(null)} />
          <Button variant="accent" type="submit">Save</Button>
          <Button type="button" onClick={() => setSaveAs(null)}>Cancel</Button>
        </form>
      )}

      <div className="relative flex-1 min-h-0 flex">
        {/* Code */}
        <div className="relative flex-1 min-w-0 overflow-auto" style={{ background: "color-mix(in oklab, var(--os-input) 70%, transparent)" }}>
          <div className={`flex min-h-full ${wrap ? "" : "min-w-full w-max"}`}>
            <div className="sticky left-0 z-10 shrink-0 w-12 overflow-hidden border-r border-line" style={{ background: "var(--os-window)" }}>
              <div className="code-layer py-3 pr-3 text-right text-faint">
                {Array.from({ length: lines }, (_, i) => (
                  <div key={i} className={i + 1 === cursor.line ? "text-fg" : ""}>{i + 1}</div>
                ))}
              </div>
            </div>
            <div className={`relative flex-1 ${wrap ? "min-w-0" : ""}`}>
              <pre className="code-layer m-0 px-4 py-3 pointer-events-none" style={layerStyle} aria-hidden dangerouslySetInnerHTML={{ __html: html }} />
              <textarea
                ref={taRef}
                value={text}
                spellCheck={false}
                autoFocus
                onChange={(e) => {
                  setText(e.target.value);
                  updateCursor();
                }}
                onKeyDown={onKeyDown}
                onKeyUp={updateCursor}
                onClick={updateCursor}
                onSelect={updateCursor}
                aria-label="Editor"
                className="code-layer absolute inset-0 w-full h-full px-4 py-3 bg-transparent outline-none resize-none overflow-hidden"
                style={{ ...layerStyle, color: "transparent", caretColor: "var(--os-accent)" }}
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className={`relative w-1/2 min-w-0 border-l border-line bg-surface ${lang === "md" ? "overflow-y-auto" : "overflow-hidden"}`}>
            {lang === "md" ? (
              <div className="p-6 chat-md text-[14px] leading-relaxed max-w-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
            ) : (
              <HtmlPreview html={previewDoc} />
            )}
            {!focused && <div className="absolute inset-0" />}
          </div>
        )}

        {quickOpen && <QuickOpen fs={fs} onPick={loadFile} onClose={() => setQuickOpen(false)} filter={(p) => !isDocument(p) || p.endsWith(".md")} />}
      </div>

      {/* Output panel */}
      {output && (
        <div className="h-44 shrink-0 flex flex-col border-t border-line bg-[rgb(8_9_16_/_0.92)] text-[#e6e8f2]">
          <div className="h-8 shrink-0 flex items-center gap-2 px-3 border-b border-white/10 text-[11.5px]">
            <span className="font-semibold tracking-wide uppercase text-white/70">Output</span>
            {running ? (
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> running
              </span>
            ) : null}
            <div className="flex-1" />
            <button title="Clear output" onClick={() => setOutput([])} className="w-6 h-6 grid place-items-center rounded-md text-white/60 hover:text-white hover:bg-white/10">
              <Trash2 size={13} />
            </button>
            <button title="Close output" onClick={() => { stopRun(); setOutput(null); }} className="w-6 h-6 grid place-items-center rounded-md text-white/60 hover:text-white hover:bg-white/10">
              <X size={14} />
            </button>
          </div>
          <div ref={outRef} className="flex-1 overflow-auto px-3 py-2 font-mono text-[12.5px] leading-5 select-text" data-output>
            {output.map((l, i) => (
              <div
                key={i}
                className="whitespace-pre-wrap break-words"
                style={{ color: l.kind === "error" ? "#fb7185" : l.kind === "warn" ? "#fbbf24" : l.kind === "info" ? "#67e8f9" : l.kind === "system" ? "#8b90a8" : undefined }}
              >
                {l.text}
              </div>
            ))}
          </div>
          {run && (
            <CodeRunner
              key={run.id}
              html={run.html}
              lineOffset={run.lineOffset}
              onLine={(l) => setOutput((o) => [...(o ?? []), l])}
              onLoaded={() => {
                setRunning(false);
                setOutput((o) => [...(o ?? []), { kind: "system", text: `✓ Finished in ${Math.round(performance.now() - run.started)} ms` }]);
              }}
            />
          )}
        </div>
      )}

      {/* Status bar */}
      <div className="h-7 shrink-0 flex items-center gap-4 px-3 text-[11.5px] text-accent-fg bg-accent">
        <span>Ln {cursor.line}, Col {cursor.col}</span>
        <span>{lines} lines</span>
        <div className="flex-1" />
        <span>{lang === "py" || lang === "cs" || lang === "cpp" ? "Spaces: 4" : "Spaces: 2"}</span>
        <span>UTF-8</span>
        <button onClick={languageMenu} className="hover:underline">{LANGUAGE_LABEL[lang] ?? lang}</button>
      </div>
    </div>
  );
}

