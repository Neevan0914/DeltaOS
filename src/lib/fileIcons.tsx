import { FileCode2, FileJson, FileText, Folder, Image, FileType2, File, Hash, type LucideIcon } from "lucide-react";
import { extname, type VNode } from "../os/vfs";

export function fileVisual(name: string, node: VNode): { icon: LucideIcon; color: string } {
  if (node.type === "dir") return { icon: Folder, color: "#60a5fa" };
  const ext = extname(name);
  if (["ts", "tsx", "js", "jsx", "py", "rs", "go", "c", "cpp", "java", "sh", "html"].includes(ext)) return { icon: FileCode2, color: "#a78bfa" };
  if (ext === "json") return { icon: FileJson, color: "#fbbf24" };
  if (ext === "css") return { icon: Hash, color: "#38bdf8" };
  if (ext === "md") return { icon: FileType2, color: "#34d399" };
  if (["png", "jpg", "jpeg", "svg", "gif"].includes(ext)) return { icon: Image, color: "#f472b6" };
  if (["txt", "log", ""].includes(ext)) return { icon: FileText, color: "#cbd5e1" };
  return { icon: File, color: "#cbd5e1" };
}

export function FileGlyph({ name, node, size = 40 }: { name: string; node: VNode; size?: number }) {
  const { icon: Icon, color } = fileVisual(name, node);
  if (node.type === "dir") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>
          <linearGradient id="fg-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4f8df7" />
            <stop offset="1" stopColor="#2f6de0" />
          </linearGradient>
          <linearGradient id="fg-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8ec5ff" />
            <stop offset="1" stopColor="#4a90f5" />
          </linearGradient>
        </defs>
        <path d="M4 12a4 4 0 0 1 4-4h10l4 4h18a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" fill="url(#fg-back)" />
        <path d="M4 18a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" fill="url(#fg-front)" />
        <path d="M4 18a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v1H4Z" fill="#fff" opacity="0.25" />
      </svg>
    );
  }
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size * 0.82} height={size} viewBox="0 0 40 48" className="absolute" aria-hidden>
        <path d="M4 4a3 3 0 0 1 3-3h19l10 10v33a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" fill="#f5f6fa" />
        <path d="M26 1v7a3 3 0 0 0 3 3h7Z" fill="#cfd4e3" />
      </svg>
      <Icon size={size * 0.38} color={color === "#cbd5e1" ? "#64748b" : color} strokeWidth={2.2} className="relative mt-[18%]" />
    </div>
  );
}
