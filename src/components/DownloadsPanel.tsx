import { useEffect, useRef, useState } from "react";
import { Download as DownloadIcon, FolderOpen, X, CheckCircle2, AlertCircle, Ban } from "lucide-react";
import { cancelDownload, clearFinished, DOWNLOADS_DIR, useDownloads, type Download } from "../os/downloads";
import { openApp } from "../os/windows";
import { openPath } from "../os/open";
import { formatSize, getNode } from "../os/vfs";
import { getState } from "../os/store";
import { FileGlyph } from "../lib/fileIcons";

/** Toolbar button + popover listing downloads. Everything downloaded lands in DeltaOS's ~/Downloads. */
export function DownloadsButton() {
  const downloads = useDownloads();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = downloads.filter((d) => d.state === "progressing");
  const received = active.reduce((s, d) => s + d.received, 0);
  const total = active.reduce((s, d) => s + d.total, 0);
  const pct = total ? Math.min(1, received / total) : 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  // Pop open when a new download starts, like a real browser.
  const count = downloads.length;
  const prev = useRef(count);
  useEffect(() => {
    if (count > prev.current) setOpen(true);
    prev.current = count;
  }, [count]);

  if (!downloads.length) return null;
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        aria-label="Downloads"
        title="Downloads (saved inside DeltaOS)"
        onClick={() => setOpen((v) => !v)}
        className={`relative w-8 h-8 grid place-items-center rounded-lg transition-colors ${open ? "bg-surface-2 text-fg" : "text-muted hover:text-fg hover:bg-surface-2"}`}
      >
        {active.length > 0 && (
          <svg className="absolute inset-0.5" viewBox="0 0 36 36" aria-hidden>
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--os-border)" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--os-accent)" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={`${pct * 94.2} 94.2`} transform="rotate(-90 18 18)" />
          </svg>
        )}
        <DownloadIcon size={15} className={active.length ? "text-accent" : ""} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-[340px] rounded-xl glass-menu p-2 anim-pop-down text-fg" data-downloads-panel>
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <div className="text-[13px] font-semibold">Downloads</div>
            <button className="text-[11.5px] text-muted hover:text-fg" onClick={clearFinished}>Clear list</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {downloads.map((d) => <Row key={d.id} d={d} />)}
          </div>
          <button
            onClick={() => { openApp("files", { cwd: DOWNLOADS_DIR }); setOpen(false); }}
            className="mt-1 w-full flex items-center justify-center gap-2 h-8 rounded-lg text-[12.5px] hover:bg-surface-2"
          >
            <FolderOpen size={14} /> Open Downloads folder
          </button>
          <div className="px-2 pt-1 text-[10.5px] text-faint text-center">Downloads stay inside DeltaOS. Use Files → Export to copy one to your PC.</div>
        </div>
      )}
    </div>
  );
}

function Row({ d }: { d: Download }) {
  const exists = d.path ? !!getNode(getState().fs, d.path) : false;
  const pct = d.total ? Math.min(100, (d.received / d.total) * 100) : 0;
  const status =
    d.state === "progressing"
      ? d.total ? `${formatSize(d.received)} of ${formatSize(d.total)}` : `${formatSize(d.received)}…`
      : d.state === "completed"
        ? exists ? `${formatSize(d.total)} · ~/Downloads` : "Deleted"
        : d.state === "cancelled" ? "Cancelled" : "Failed";
  return (
    <div
      className={`group flex items-center gap-3 p-2 rounded-lg ${d.state === "completed" && exists ? "hover:bg-surface-2 cursor-default" : ""}`}
      onClick={() => d.state === "completed" && exists && d.path && openPath(d.path)}
    >
      <FileGlyph name={d.filename} node={{ type: "file", content: "", mtime: 0 }} size={28} />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium truncate" title={d.filename}>{d.filename}</div>
        {d.state === "progressing" && (
          <div className="h-1 mt-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-accent transition-[width]" style={{ width: d.total ? `${pct}%` : "30%" }} />
          </div>
        )}
        <div className="text-[11px] text-muted mt-1 flex items-center gap-1">
          {d.state === "completed" && exists && <CheckCircle2 size={11} className="text-emerald-400" />}
          {d.state === "interrupted" && <AlertCircle size={11} className="text-rose-400" />}
          {d.state === "cancelled" && <Ban size={11} />}
          {status}
        </div>
      </div>
      {d.state === "progressing" && (
        <button aria-label="Cancel download" title="Cancel" onClick={(e) => { e.stopPropagation(); cancelDownload(d.id); }}
          className="w-6 h-6 grid place-items-center rounded-md text-muted hover:text-fg hover:bg-surface-2">
          <X size={13} />
        </button>
      )}
    </div>
  );
}
