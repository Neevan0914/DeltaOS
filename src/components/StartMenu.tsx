import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Power, RotateCcw, Search, ChevronRight } from "lucide-react";
import { APPS } from "../apps/registry";
import { setState, useOS, type AppId, type Phase } from "../os/store";
import { openApp } from "../os/windows";
import { sendMessage, toggleAssistant } from "../os/assistant";
import { HOME, prettyPath, type VDir, type VNode } from "../os/vfs";
import { AppIcon } from "./AppIcon";
import { Avatar } from "./Avatar";
import { ClaudeMark } from "./Logo";
import { FileGlyph } from "../lib/fileIcons";

function walkFiles(dir: VDir, base: string, out: { path: string; name: string; node: VNode }[] = []) {
  for (const [name, node] of Object.entries(dir.children)) {
    if (name.startsWith(".")) continue;
    const path = base === "/" ? `/${name}` : `${base}/${name}`;
    out.push({ path, name, node });
    if (node.type === "dir") walkFiles(node, path, out);
  }
  return out;
}

export function StartMenu({ onPower }: { onPower: (p: Phase | "lock") => void }) {
  const fs = useOS((s) => s.fs);
  const username = useOS((s) => s.settings.username);
  const [query, setQuery] = useState("");
  const [powerOpen, setPowerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest("[data-start-toggle]")) return;
      setState({ startOpen: false });
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setState({ startOpen: false });
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  const allFiles = useMemo(() => walkFiles(fs.children.home as VDir, "/home"), [fs]);
  const recent = useMemo(
    () => allFiles.filter((f) => f.node.type === "file").sort((a, b) => b.node.mtime - a.node.mtime).slice(0, 4),
    [allFiles],
  );
  const q = query.trim().toLowerCase();
  const appHits = (Object.keys(APPS) as AppId[]).filter((a) => !q || APPS[a].title.toLowerCase().includes(q) || a.includes(q));
  const fileHits = q ? allFiles.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 6) : [];

  const openFile = (f: { path: string; node: VNode }) => {
    if (f.node.type === "dir") openApp("files", { cwd: f.path });
    else openApp("editor", { path: f.path });
  };
  const askClaude = () => {
    setState({ startOpen: false });
    toggleAssistant(true);
    void sendMessage(query);
  };

  return (
    <div
      ref={ref}
      className="absolute left-1/2 -translate-x-1/2 bottom-[66px] w-[600px] rounded-2xl glass-menu z-[9500] anim-pop-in text-fg overflow-hidden"
    >
      <div className="p-5 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !q) return;
              if (appHits[0]) openApp(appHits[0]);
              else if (fileHits[0]) openFile(fileHits[0]);
              else askClaude();
            }}
            placeholder="Search apps, files, or ask Claude…"
            className="os-input w-full !pl-10 !h-10 !rounded-full"
          />
        </div>
      </div>

      <div className="px-5 pb-4 min-h-[300px]">
        {appHits.length > 0 && <SectionTitle>{q ? "Apps" : "Pinned"}</SectionTitle>}
        <div className="grid grid-cols-6 gap-1">
          {appHits.map((a) => (
            <button key={a} onClick={() => openApp(a)} className="flex flex-col items-center gap-2 py-3 rounded-xl hover:bg-surface-2 transition-colors">
              <AppIcon app={a} size={40} />
              <span className="text-[11.5px] text-fg/90 truncate max-w-full px-1">{APPS[a].title}</span>
            </button>
          ))}
        </div>

        {q ? (
          <>
            {fileHits.length > 0 && (
              <>
                <SectionTitle>Files</SectionTitle>
                <div className="grid grid-cols-2 gap-1">
                  {fileHits.map((f) => (
                    <FileRow key={f.path} f={f} onOpen={() => openFile(f)} />
                  ))}
                </div>
              </>
            )}
            <SectionTitle>Claude</SectionTitle>
            <button onClick={askClaude} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-2 text-left transition-colors">
              <div className="w-9 h-9 rounded-lg grid place-items-center text-white" style={{ background: "linear-gradient(135deg, #f0a27a, #d97757)" }}>
                <ClaudeMark size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">Ask Claude: “{query}”</div>
                <div className="text-[11.5px] text-muted">Get an answer or let Claude do it for you</div>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </button>
          </>
        ) : (
          <>
            <SectionTitle>Recent</SectionTitle>
            <div className="grid grid-cols-2 gap-1">
              {recent.map((f) => (
                <FileRow key={f.path} f={f} onOpen={() => openFile(f)} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative flex items-center justify-between px-6 h-16 border-t border-line bg-surface">
        <button
          onClick={() => openApp("settings", { section: "account" })}
          className="flex items-center gap-3 rounded-xl px-2 py-1.5 -ml-2 hover:bg-surface-2 transition-colors"
        >
          <Avatar name={username} size={32} />
          <span className="text-[13px] font-medium">{username}</span>
        </button>
        <button onClick={() => setPowerOpen((v) => !v)} className="w-9 h-9 rounded-xl grid place-items-center hover:bg-surface-2" title="Power">
          <Power size={17} />
        </button>
        {powerOpen && (
          <div className="absolute right-4 bottom-[60px] w-44 p-1.5 rounded-xl glass-menu anim-pop-in">
            {[
              { label: "Lock", icon: Lock, act: () => onPower("lock") },
              { label: "Restart", icon: RotateCcw, act: () => onPower("restart") },
              { label: "Shut down", icon: Power, act: () => onPower("shutdown") },
            ].map((i) => (
              <button
                key={i.label}
                onClick={() => {
                  setState({ startOpen: false });
                  i.act();
                }}
                className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] hover:bg-accent hover:text-accent-fg"
              >
                <i.icon size={15} /> {i.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold text-muted mt-3 mb-1.5 px-1">{children}</div>;
}

function FileRow({ f, onOpen }: { f: { path: string; name: string; node: VNode }; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-2 text-left transition-colors min-w-0">
      <FileGlyph name={f.name} node={f.node} size={30} />
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium truncate">{f.name}</div>
        <div className="text-[11px] text-muted truncate">{prettyPath(f.path.replace(/\/[^/]+$/, "") || HOME)}</div>
      </div>
    </button>
  );
}

