import { useEffect, useState } from "react";
import { FolderPlus, FilePlus, Pencil, Trash2, ExternalLink, SquareTerminal, Palette, FileCode2, RefreshCw } from "lucide-react";
import { APPS } from "../apps/registry";
import { notify, setFs, useOS, type AppId } from "../os/store";
import { openApp, TASKBAR_H } from "../os/windows";
import { FsError, HOME, getNode, listDir, mkdir, remove, rename, uniqueName, writeFile, type VDir, type VNode } from "../os/vfs";
import { showContextMenu } from "../os/contextMenu";
import { AppIcon } from "./AppIcon";
import { FileGlyph } from "../lib/fileIcons";
import { InlineInput } from "./ui";

const DESKTOP = `${HOME}/Desktop`;
const DESKTOP_APPS: AppId[] = ["files", "terminal", "editor", "settings"];
const CELL_W = 92;
const CELL_H = 100;

type Entry = { key: string; label: string; kind: "app"; app: AppId } | { key: string; label: string; kind: "node"; node: VNode; path: string };

export function DesktopIcons() {
  const fs = useOS((s) => s.fs);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [rows, setRows] = useState(() => Math.max(1, Math.floor((window.innerHeight - TASKBAR_H - 24) / CELL_H)));

  useEffect(() => {
    const onResize = () => setRows(Math.max(1, Math.floor((window.innerHeight - TASKBAR_H - 24) / CELL_H)));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const desk = getNode(fs, DESKTOP);
  const entries: Entry[] = [
    ...DESKTOP_APPS.map((app) => ({ key: `app:${app}`, label: APPS[app].title, kind: "app" as const, app })),
    ...(desk?.type === "dir"
      ? listDir(desk)
          .filter(([n]) => !n.startsWith("."))
          .map(([name, node]) => ({ key: `${DESKTOP}/${name}`, label: name, kind: "node" as const, node, path: `${DESKTOP}/${name}` }))
      : []),
  ];

  const safe = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      notify("Couldn't complete action", e instanceof FsError ? e.message : String(e), "error");
    }
  };

  const open = (e: Entry) => {
    if (e.kind === "app") openApp(e.app);
    else if (e.node.type === "dir") openApp("files", { cwd: e.path });
    else openApp("editor", { path: e.path });
  };

  const createNew = (kind: "folder" | "file") =>
    safe(() => {
      let created = "";
      setFs((root) => {
        const r = getNode(root, DESKTOP) ? root : mkdir(root, DESKTOP, true);
        const parent = getNode(r, DESKTOP) as VDir;
        const name = kind === "folder" ? uniqueName(parent, "New Folder") : uniqueName(parent, "New Text Document", ".txt");
        created = `${DESKTOP}/${name}`;
        return kind === "folder" ? mkdir(r, created) : writeFile(r, created, "");
      });
      setSelected(created);
      setRenaming(created);
    });

  // Delete key on selected desktop item
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || selected.startsWith("app:") || renaming) return;
      if ((e.target as HTMLElement)?.closest?.("input, textarea, [role=dialog]")) return;
      if (e.key === "Delete") safe(() => setFs((r) => remove(r, selected, true)));
      if (e.key === "F2") setRenaming(selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, renaming]);

  return (
    <div
      className="absolute inset-0"
      style={{ bottom: TASKBAR_H }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}
      onContextMenu={(e) => {
        if (e.target !== e.currentTarget) return;
        showContextMenu(e, [
          { label: "New Folder", icon: FolderPlus, onClick: () => createNew("folder") },
          { label: "New Text Document", icon: FilePlus, onClick: () => createNew("file") },
          { separator: true },
          { label: "Open in Terminal", icon: SquareTerminal, onClick: () => openApp("terminal", { cwd: DESKTOP }) },
          { label: "Open Code Editor", icon: FileCode2, onClick: () => openApp("editor") },
          { label: "Refresh", icon: RefreshCw, onClick: () => setSelected(null) },
          { separator: true },
          { label: "Personalize", icon: Palette, onClick: () => openApp("settings", { section: "appearance" }) },
        ]);
      }}
    >
      {entries.map((e, i) => {
        const col = Math.floor(i / rows);
        const row = i % rows;
        const isSel = selected === e.key;
        return (
          <div
            key={e.key}
            data-desktop-icon={e.label}
            className={`absolute flex flex-col items-center gap-1 pt-2 rounded-xl border transition-colors ${
              isSel ? "bg-accent/25 border-accent/50" : "border-transparent hover:bg-white/10"
            }`}
            style={{ left: 12 + col * CELL_W, top: 12 + row * CELL_H, width: CELL_W - 8, height: CELL_H - 8 }}
            onPointerDown={() => setSelected(e.key)}
            onDoubleClick={() => open(e)}
            onContextMenu={(ev) => {
              setSelected(e.key);
              showContextMenu(ev, [
                { label: "Open", icon: ExternalLink, onClick: () => open(e) },
                ...(e.kind === "node"
                  ? [
                      { label: "Rename", icon: Pencil, shortcut: "F2", onClick: () => setRenaming(e.key) },
                      { separator: true },
                      { label: "Delete", icon: Trash2, shortcut: "Del", danger: true, onClick: () => safe(() => setFs((r) => remove(r, e.path, true))) },
                    ]
                  : []),
              ]);
            }}
          >
            <div className="drop-shadow-[0_4px_10px_rgb(0_0_0_/_0.35)]">
              {e.kind === "app" ? <AppIcon app={e.app} size={46} /> : <FileGlyph name={e.label} node={e.node} size={48} />}
            </div>
            {renaming === e.key && e.kind === "node" ? (
              <InlineInput
                initial={e.label}
                className="w-[84px] text-[12px]"
                onCommit={(v) => {
                  safe(() => setFs((r) => rename(r, e.path, v)));
                  setSelected(`${DESKTOP}/${v}`);
                  setRenaming(null);
                }}
                onCancel={() => setRenaming(null)}
              />
            ) : (
              <span
                className={`text-[12px] leading-tight text-center text-white px-1 break-words max-w-full ${isSel ? "" : "line-clamp-2"}`}
                style={{ textShadow: "0 1px 3px rgb(0 0 0 / 0.8), 0 0 8px rgb(0 0 0 / 0.4)" }}
              >
                {e.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
