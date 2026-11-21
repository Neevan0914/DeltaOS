import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { basename, dirname, prettyPath, type VDir } from "../os/vfs";
import { FileGlyph } from "../lib/fileIcons";

/** Fuzzy-ish file picker overlay used by Code and Folio. */
export function QuickOpen({
  fs,
  onPick,
  onClose,
  filter = () => true,
  placeholder = "Open file by name…",
}: {
  fs: VDir;
  onPick: (p: string) => void;
  onClose: () => void;
  filter?: (path: string) => boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const files = useMemo(() => {
    const out: string[] = [];
    const walk = (d: VDir, base: string) => {
      for (const [n, c] of Object.entries(d.children)) {
        const p = `${base}/${n}`;
        if (c.type === "dir") walk(c, p);
        else if (!c.blob && filter(p)) out.push(p);
      }
    };
    walk(fs, "");
    return out;
  }, [fs, filter]);
  const hits = files.filter((f) => f.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  return (
    <div className="absolute inset-0 z-20 flex justify-center pt-8 bg-black/10" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[460px] h-fit rounded-xl glass-menu p-2 anim-pop-down text-fg">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            value={q}
            placeholder={placeholder}
            className="os-input w-full !pl-9"
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setIdx((i) => Math.min(hits.length - 1, i + 1));
              if (e.key === "ArrowUp") setIdx((i) => Math.max(0, i - 1));
              if (e.key === "Enter" && hits[idx]) onPick(hits[idx]);
            }}
          />
        </div>
        <div className="mt-1.5 max-h-80 overflow-y-auto">
          {hits.map((p, i) => (
            <button
              key={p}
              onClick={() => onPick(p)}
              onMouseEnter={() => setIdx(i)}
              className={`w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-left ${i === idx ? "bg-accent text-accent-fg" : ""}`}
            >
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
