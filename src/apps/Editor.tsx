import { useEffect, useMemo, useRef, useState } from "react";
import { Save, FilePlus2, FolderOpen, WrapText, Eye, Search, Check } from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { getState, notify, setFs, useOS } from "../os/store";
import { updateWindow } from "../os/windows";
import { basename, dirname, FsError, getNode, HOME, mkdir, prettyPath, resolvePath, writeFile, type VDir } from "../os/vfs";
import { highlight, languageOf, LANGUAGE_LABEL } from "../lib/highlight";
import { renderMarkdown } from "../lib/markdown";
import { Button, IconButton } from "../components/ui";
import { FileGlyph } from "../lib/fileIcons";

export function Editor({ win }: AppProps) {
  const fs = useOS((s) => s.fs);
  const [path, setPath] = useState<string | null>((win.props.path as string) ?? null);
  const fileNode = path ? getNode(fs, path) : null;
  const [text, setText] = useState(() => (fileNode?.type === "file" ? fileNode.content : ""));
  const [saved, setSaved] = useState(text);
  const [wrap, setWrap] = useState(false);
  const [preview, setPreview] = useState(() => (path ? languageOf(path) === "md" : false));
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [saveAs, setSaveAs] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const name = path ? basename(path) : "Untitled";
  const lang = languageOf(name);
  const dirty = text !== saved;

  useEffect(() => {
    updateWindow(win.id, { title: `${dirty ? "● " : ""}${name} — Code` });
  }, [name, dirty, win.id]);

  // React to "open this file" requests targeted at this window
  useEffect(() => {
    const p = win.props.path as string | undefined;
    if (p && p !== path) loadFile(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props.path]);

  const loadFile = (p: string) => {
    const n = getNode(getState().fs, p);
    if (n?.type !== "file") return notify("Code", `Can't open ${p}`, "error");
    setPath(p);
    setText(n.content);
    setSaved(n.content);
    setPreview(languageOf(p) === "md");
    setQuickOpen(false);
  };

  const save = (target = path) => {
    if (!target) {
      setSaveAs(`~/Documents/${name === "Untitled" ? "untitled.txt" : name}`);
      return;
    }
    try {
      setFs((r) => writeFile(mkdir(r, dirname(target), true), target, text));
      setPath(target);
      setSaved(text);
      setSaveAs(null);
    } catch (e) {
      notify("Couldn't save", e instanceof FsError ? e.message : String(e), "error");
    }
  };

  const lines = useMemo(() => text.split("\n").length, [text]);
  const html = useMemo(() => highlight(text, lang) + "\n ", [text, lang]);

  const updateCursor = () => {
    const ta = taRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const ls = before.split("\n");
    setCursor({ line: ls.length, col: ls[ls.length - 1].length + 1 });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (e.shiftKey) setSaveAs(path ? prettyPath(path) : "~/Documents/untitled.txt");
      else save();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
      e.preventDefault();
      setQuickOpen(true);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end } = ta;
      const next = text.slice(0, s) + "  " + text.slice(end);
      setText(next);
      requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2));
    } else if (e.key === "Enter") {
      const s = ta.selectionStart;
      const lineStart = text.lastIndexOf("\n", s - 1) + 1;
      const indent = text.slice(lineStart, s).match(/^\s*/)?.[0] ?? "";
      const extra = /[{[(:]\s*$/.test(text.slice(lineStart, s)) ? "  " : "";
      if (indent || extra) {
        e.preventDefault();
        const ins = "\n" + indent + extra;
        setText(text.slice(0, s) + ins + text.slice(ta.selectionEnd));
        requestAnimationFrame(() => ta.setSelectionRange(s + ins.length, s + ins.length));
      }
    }
  };

  const layerStyle: React.CSSProperties = wrap ? { whiteSpace: "pre-wrap", wordBreak: "break-word" } : {};

  return (
    <div className="absolute inset-0 flex flex-col text-fg">
      {/* Toolbar */}
      <div className="h-11 shrink-0 flex items-center gap-1 px-2.5 border-b border-line bg-surface">
        <IconButton title="New file" onClick={() => { setPath(null); setText(""); setSaved(""); setPreview(false); }}><FilePlus2 size={16} /></IconButton>
        <IconButton title="Open… (Ctrl+O)" onClick={() => setQuickOpen((v) => !v)}><FolderOpen size={16} /></IconButton>
        <IconButton title="Save (Ctrl+S)" onClick={() => save()}><Save size={16} /></IconButton>
        <div className="w-px h-5 bg-line mx-1" />
        <div className="flex items-center gap-2 min-w-0 px-1">
          <FileGlyph name={name} node={{ type: "file", content: "", mtime: 0 }} size={20} />
          <span className="text-[13px] font-medium truncate">{name}</span>
          {dirty ? <span className="w-2 h-2 rounded-full bg-accent shrink-0" title="Unsaved changes" /> : path && <Check size={14} className="text-emerald-400 shrink-0" />}
          <span className="text-[11.5px] text-faint truncate">{path ? prettyPath(dirname(path)) : "not saved"}</span>
        </div>
        <div className="flex-1" />
        <IconButton title="Word wrap" active={wrap} onClick={() => setWrap((w) => !w)}><WrapText size={16} /></IconButton>
        {lang === "md" && <IconButton title="Preview" active={preview} onClick={() => setPreview((p) => !p)}><Eye size={16} /></IconButton>}
      </div>

      {saveAs !== null && (
        <form
          className="flex items-center gap-2 px-3 py-2 border-b border-line bg-accent/10 anim-pop-down"
          onSubmit={(e) => { e.preventDefault(); save(resolvePath(HOME, saveAs)); }}
        >
          <span className="text-[12.5px] text-muted shrink-0">Save as</span>
          <input autoFocus value={saveAs} onChange={(e) => setSaveAs(e.target.value)} className="os-input flex-1 !h-8 !py-0 font-mono !text-[12.5px]"
            onKeyDown={(e) => e.key === "Escape" && setSaveAs(null)} />
          <Button variant="accent" type="submit">Save</Button>
          <Button type="button" onClick={() => setSaveAs(null)}>Cancel</Button>
        </form>
      )}

      <div className="relative flex-1 min-h-0 flex">
        {/* Code */}
        <div
          className="relative flex-1 min-w-0 overflow-auto"
          style={{ background: "color-mix(in oklab, var(--os-input) 70%, transparent)" }}
        >
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
                onChange={(e) => { setText(e.target.value); updateCursor(); }}
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

        {/* Markdown preview */}
        {preview && lang === "md" && (
          <div className="w-1/2 min-w-0 border-l border-line overflow-y-auto p-6 bg-surface">
            <div className="chat-md text-[14px] leading-relaxed max-w-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
          </div>
        )}

        {quickOpen && <QuickOpen fs={fs} onPick={loadFile} onClose={() => setQuickOpen(false)} />}
      </div>

      {/* Status bar */}
      <div className="h-7 shrink-0 flex items-center gap-4 px-3 text-[11.5px] text-accent-fg bg-accent">
        <span>Ln {cursor.line}, Col {cursor.col}</span>
        <span>{lines} lines</span>
        <div className="flex-1" />
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span>{LANGUAGE_LABEL[lang]}</span>
      </div>
    </div>
  );
}

function QuickOpen({ fs, onPick, onClose }: { fs: VDir; onPick: (p: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const files = useMemo(() => {
    const out: string[] = [];
    const walk = (d: VDir, base: string) => {
      for (const [n, c] of Object.entries(d.children)) {
        const p = `${base}/${n}`;
        if (c.type === "dir") walk(c, p);
        else out.push(p);
      }
    };
    walk(fs, "");
    return out;
  }, [fs]);
  const hits = files.filter((f) => f.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  return (
    <div className="absolute inset-0 z-20 flex justify-center pt-8 bg-black/10" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[460px] h-fit rounded-xl glass-menu p-2 anim-pop-down">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input autoFocus value={q} placeholder="Open file by name…" className="os-input w-full !pl-9"
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setIdx((i) => Math.min(hits.length - 1, i + 1));
              if (e.key === "ArrowUp") setIdx((i) => Math.max(0, i - 1));
              if (e.key === "Enter" && hits[idx]) onPick(hits[idx]);
            }} />
        </div>
        <div className="mt-1.5 max-h-80 overflow-y-auto">
          {hits.map((p, i) => (
            <button key={p} onClick={() => onPick(p)} onMouseEnter={() => setIdx(i)}
              className={`w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-left ${i === idx ? "bg-accent text-accent-fg" : ""}`}>
              <FileGlyph name={basename(p)} node={{ type: "file", content: "", mtime: 0 }} size={18} />
              <span className="text-[13px] font-medium">{basename(p)}</span>
              <span className={`text-[11.5px] truncate ${i === idx ? "opacity-70" : "text-faint"}`}>{prettyPath(dirname(p))}</span>
            </button>
          ))}
          {!hits.length && <div className="text-[12.5px] text-muted px-3 py-2">No files found</div>}
        </div>
      </div>
    </div>
  );
}
