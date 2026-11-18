import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUp, ChevronRight, Code2, Download, FileCode2, FilePlus, FolderPlus, HardDrive, Home, Image, LayoutGrid,
  List, Monitor, FileText, Pencil, Search, SquareTerminal, Trash2, ExternalLink, Settings2,
} from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { notify, setFs, useOS } from "../os/store";
import { openApp, updateWindow } from "../os/windows";
import { showContextMenu } from "../os/contextMenu";
import {
  basename, dirname, formatSize, FsError, getNode, HOME, listDir, mkdir, move, nodeSize, remove, rename, uniqueName, writeFile, extname,
  type VDir, type VNode,
} from "../os/vfs";
import { FileGlyph } from "../lib/fileIcons";
import { IconButton, InlineInput } from "../components/ui";

const PLACES = [
  { label: "Home", path: HOME, icon: Home },
  { label: "Desktop", path: `${HOME}/Desktop`, icon: Monitor },
  { label: "Documents", path: `${HOME}/Documents`, icon: FileText },
  { label: "Code", path: `${HOME}/Code`, icon: Code2 },
  { label: "Pictures", path: `${HOME}/Pictures`, icon: Image },
  { label: "Downloads", path: `${HOME}/Downloads`, icon: Download },
];
const LOCATIONS = [
  { label: "Delta Disk", path: "/", icon: HardDrive },
  { label: "System", path: "/system", icon: Settings2 },
];

export function FileExplorer({ win }: AppProps) {
  const fs = useOS((s) => s.fs);
  const [cwd, setCwd] = useState<string>(() => (win.props.cwd as string) || HOME);
  const [back, setBack] = useState<string[]>([]);
  const [fwd, setFwd] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // External navigation requests (e.g. "open ~/Documents" while the window is already open)
  useEffect(() => {
    const p = win.props.cwd as string | undefined;
    if (p && p !== cwd) navigate(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props.cwd]);

  const node = getNode(fs, cwd);
  const dirNode: VDir | null = node?.type === "dir" ? node : null;

  useEffect(() => {
    if (!dirNode) setCwd(HOME);
  }, [dirNode]);

  useEffect(() => {
    updateWindow(win.id, { title: `Files — ${cwd === "/" ? "Delta Disk" : cwd === HOME ? "Home" : basename(cwd)}` });
  }, [cwd, win.id]);

  const entries = useMemo(() => {
    if (!dirNode) return [];
    const q = query.trim().toLowerCase();
    return listDir(dirNode).filter(([n]) => !n.startsWith(".") && (!q || n.toLowerCase().includes(q)));
  }, [dirNode, query]);

  const navigate = (p: string, record = true) => {
    if (getNode(fs, p)?.type !== "dir") return;
    if (record && p !== cwd) {
      setBack((b) => [...b, cwd]);
      setFwd([]);
    }
    setCwd(p);
    setSelected(null);
    setQuery("");
  };

  const safe = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      notify("Files", e instanceof FsError ? e.message : String(e), "error");
    }
  };

  const pathOf = (name: string) => (cwd === "/" ? `/${name}` : `${cwd}/${name}`);
  const openEntry = (name: string, n: VNode) => (n.type === "dir" ? navigate(pathOf(name)) : openApp("editor", { path: pathOf(name) }));

  const createNew = (kind: "folder" | "file") =>
    safe(() => {
      if (!dirNode) return;
      const name = kind === "folder" ? uniqueName(dirNode, "New Folder") : uniqueName(dirNode, "Untitled", ".txt");
      setFs((r) => (kind === "folder" ? mkdir(r, pathOf(name)) : writeFile(r, pathOf(name), "")));
      setSelected(name);
      setRenaming(name);
    });

  const del = (name: string) => safe(() => {
    setFs((r) => remove(r, pathOf(name), true));
    setSelected(null);
  });

  const dropOn = (targetDir: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const src = e.dataTransfer.getData("text/delta-path");
    if (!src || dirname(src) === targetDir || src === targetDir) return;
    safe(() => setFs((r) => move(r, src, targetDir)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!document.activeElement?.closest?.(`[data-files="${win.id}"]`)) return;
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Backspace" || (e.altKey && e.key === "ArrowUp")) navigate(dirname(cwd));
      if (!selected) return;
      if (e.key === "Delete") del(selected);
      if (e.key === "F2") setRenaming(selected);
      if (e.key === "Enter") {
        const n = dirNode?.children[selected];
        if (n) openEntry(selected, n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Breadcrumbs: paths inside the home folder start at "Home" instead of /home/user.
  const inHome = cwd === HOME || cwd.startsWith(HOME + "/");
  const crumbPaths = (() => {
    const parts = cwd.split("/").filter(Boolean);
    const all = parts.map((_, i) => "/" + parts.slice(0, i + 1).join("/"));
    return inHome ? all.filter((p) => p.length >= HOME.length) : all;
  })();
  const selNode = selected ? dirNode?.children[selected] : undefined;

  const itemMenu = (e: React.MouseEvent, name: string, n: VNode) => {
    setSelected(name);
    showContextMenu(e, [
      { label: "Open", icon: ExternalLink, onClick: () => openEntry(name, n) },
      ...(n.type === "file"
        ? [{ label: "Open with Code", icon: FileCode2, onClick: () => openApp("editor", { path: pathOf(name) }) }]
        : [
            { label: "Open in new window", icon: ExternalLink, onClick: () => openApp("files", { cwd: pathOf(name) }) },
            { label: "Open in Terminal", icon: SquareTerminal, onClick: () => openApp("terminal", { cwd: pathOf(name) }) },
          ]),
      { separator: true },
      { label: "Rename", icon: Pencil, shortcut: "F2", onClick: () => setRenaming(name) },
      { label: "Delete", icon: Trash2, shortcut: "Del", danger: true, onClick: () => del(name) },
    ]);
  };

  return (
    <div className="absolute inset-0 flex text-fg" data-files={win.id} tabIndex={-1}>
      {/* Sidebar */}
      <div className="w-52 shrink-0 border-r border-line bg-surface p-3 overflow-y-auto">
        <SideGroup title="Favorites">
          {PLACES.map((p) => (
            <SideItem key={p.path} {...p} active={cwd === p.path} dropActive={dropTarget === p.path}
              onClick={() => navigate(p.path)}
              onDragOver={(e) => { e.preventDefault(); setDropTarget(p.path); }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => dropOn(p.path, e)}
            />
          ))}
        </SideGroup>
        <SideGroup title="Locations">
          {LOCATIONS.map((p) => (
            <SideItem key={p.path} {...p} active={cwd === p.path} onClick={() => navigate(p.path)} />
          ))}
        </SideGroup>
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-12 shrink-0 flex items-center gap-1 px-2.5 border-b border-line">
          <IconButton title="Back" disabled={!back.length} onClick={() => {
            const p = back[back.length - 1];
            setBack((b) => b.slice(0, -1));
            setFwd((f) => [cwd, ...f]);
            navigate(p, false);
          }}><ArrowLeft size={16} /></IconButton>
          <IconButton title="Forward" disabled={!fwd.length} onClick={() => {
            const [p, ...rest] = fwd;
            setFwd(rest);
            setBack((b) => [...b, cwd]);
            navigate(p, false);
          }}><ArrowRight size={16} /></IconButton>
          <IconButton title="Up" disabled={cwd === "/"} onClick={() => navigate(dirname(cwd))}><ArrowUp size={16} /></IconButton>

          <div className="flex-1 min-w-0 flex items-center h-8 px-2 mx-1.5 rounded-lg bg-input border border-line overflow-x-auto no-scrollbar">
            <button className="px-1.5 h-6 rounded-md text-[12.5px] hover:bg-surface-2 shrink-0 flex items-center gap-1.5" onClick={() => navigate(inHome ? HOME : "/")}>
              {inHome ? <Home size={13} className="text-muted" /> : <HardDrive size={13} className="text-muted" />}
              {cwd === "/" && <span className="font-semibold">Delta Disk</span>}
            </button>
            {crumbPaths.map((p, i) => (
              <div key={p} className="flex items-center shrink-0">
                {i > 0 || !inHome ? <ChevronRight size={13} className="text-faint" /> : null}
                <button onClick={() => navigate(p)} className={`px-1.5 h-6 rounded-md text-[12.5px] hover:bg-surface-2 ${i === crumbPaths.length - 1 ? "font-semibold" : "text-muted"}`}>
                  {p === HOME ? "Home" : basename(p)}
                </button>
              </div>
            ))}
          </div>

          <div className="relative w-44">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="os-input w-full !h-8 !py-0 !pl-8 !text-[12.5px]" />
          </div>
          <div className="w-px h-5 bg-line mx-1" />
          <IconButton title="New folder" onClick={() => createNew("folder")}><FolderPlus size={16} /></IconButton>
          <IconButton title="New file" onClick={() => createNew("file")}><FilePlus size={16} /></IconButton>
          <IconButton title="Grid view" active={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={16} /></IconButton>
          <IconButton title="List view" active={view === "list"} onClick={() => setView("list")}><List size={16} /></IconButton>
        </div>

        <div
          className="flex-1 overflow-auto p-3"
          onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}
          onContextMenu={(e) => {
            if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.bg) return;
            showContextMenu(e, [
              { label: "New Folder", icon: FolderPlus, onClick: () => createNew("folder") },
              { label: "New File", icon: FilePlus, onClick: () => createNew("file") },
              { separator: true },
              { label: "Open in Terminal", icon: SquareTerminal, onClick: () => openApp("terminal", { cwd }) },
            ]);
          }}
        >
          {entries.length === 0 ? (
            <div data-bg="1" className="h-full grid place-items-center text-center text-muted text-[13px]">
              <div data-bg="1">
                <div className="opacity-50 mx-auto w-fit mb-2"><FileGlyph name="" node={{ type: "dir", children: {}, mtime: 0 }} size={56} /></div>
                {query ? "No items match your search" : "This folder is empty"}
              </div>
            </div>
          ) : view === "grid" ? (
            <div data-bg="1" className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}>
              {entries.map(([name, n]) => (
                <div
                  key={name}
                  draggable={renaming !== name}
                  onDragStart={(e) => e.dataTransfer.setData("text/delta-path", pathOf(name))}
                  onDragOver={(e) => { if (n.type === "dir") { e.preventDefault(); setDropTarget(pathOf(name)); } }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => n.type === "dir" && dropOn(pathOf(name), e)}
                  onPointerDown={() => setSelected(name)}
                  onDoubleClick={() => openEntry(name, n)}
                  onContextMenu={(e) => itemMenu(e, name, n)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-colors ${
                    dropTarget === pathOf(name) ? "bg-accent/25 border-accent" : selected === name ? "bg-accent/15 border-accent/40" : "border-transparent hover:bg-surface-2"
                  }`}
                >
                  <FileGlyph name={name} node={n} size={50} />
                  {renaming === name ? (
                    <InlineInput initial={name} className="w-full text-[12px]"
                      onCommit={(v) => { safe(() => setFs((r) => rename(r, pathOf(name), v))); setSelected(v); setRenaming(null); }}
                      onCancel={() => setRenaming(null)} />
                  ) : (
                    <span className="text-[12px] text-center leading-tight break-words line-clamp-2 max-w-full">{name}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div data-bg="1" className="text-[12.5px]">
              <div className="grid grid-cols-[1fr_110px_90px_150px] px-3 h-8 items-center text-[11.5px] font-semibold text-muted border-b border-line">
                <span>Name</span><span>Kind</span><span className="text-right pr-4">Size</span><span>Modified</span>
              </div>
              {entries.map(([name, n]) => (
                <div
                  key={name}
                  draggable={renaming !== name}
                  onDragStart={(e) => e.dataTransfer.setData("text/delta-path", pathOf(name))}
                  onDragOver={(e) => { if (n.type === "dir") { e.preventDefault(); setDropTarget(pathOf(name)); } }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => n.type === "dir" && dropOn(pathOf(name), e)}
                  onPointerDown={() => setSelected(name)}
                  onDoubleClick={() => openEntry(name, n)}
                  onContextMenu={(e) => itemMenu(e, name, n)}
                  className={`grid grid-cols-[1fr_110px_90px_150px] px-3 h-9 items-center rounded-lg ${
                    dropTarget === pathOf(name) ? "bg-accent/25" : selected === name ? "bg-accent/15" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <FileGlyph name={name} node={n} size={22} />
                    {renaming === name ? (
                      <InlineInput initial={name} className="!text-left text-[12.5px]"
                        onCommit={(v) => { safe(() => setFs((r) => rename(r, pathOf(name), v))); setSelected(v); setRenaming(null); }}
                        onCancel={() => setRenaming(null)} />
                    ) : (
                      <span className="truncate">{name}</span>
                    )}
                  </span>
                  <span className="text-muted">{n.type === "dir" ? "Folder" : `${extname(name).toUpperCase() || "Plain"} file`}</span>
                  <span className="text-muted text-right pr-4">{n.type === "dir" ? `${Object.keys(n.children).length} items` : formatSize(nodeSize(n))}</span>
                  <span className="text-muted">{new Date(n.mtime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-8 shrink-0 flex items-center justify-between px-4 border-t border-line text-[11.5px] text-muted">
          <span>{entries.length} item{entries.length === 1 ? "" : "s"}</span>
          <span>
            {selNode && selected
              ? `${selected} · ${selNode.type === "dir" ? `${Object.keys(selNode.children).length} items` : formatSize(nodeSize(selNode))}`
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function SideGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-semibold text-faint uppercase tracking-wider px-2 mb-1">{title}</div>
      {children}
    </div>
  );
}

function SideItem({
  label, icon: Icon, active, dropActive, onClick, onDragOver, onDragLeave, onDrop,
}: {
  label: string; icon: React.ComponentType<{ size?: number; className?: string }>; active: boolean; dropActive?: boolean; onClick: () => void;
  onDragOver?: (e: React.DragEvent) => void; onDragLeave?: () => void; onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`w-full flex items-center gap-2.5 h-8 px-2 rounded-lg text-[13px] transition-colors ${
        dropActive ? "bg-accent/30" : active ? "bg-accent/15 text-fg font-medium" : "text-muted hover:text-fg hover:bg-surface-2"
      }`}
    >
      <Icon size={16} className={active ? "text-accent" : ""} />
      {label}
    </button>
  );
}
