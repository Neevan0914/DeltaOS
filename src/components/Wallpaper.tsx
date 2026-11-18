import { wallpaperById } from "../os/wallpapers";
import { useOS } from "../os/store";

export function Wallpaper({ blur = 0, dim = 0 }: { blur?: number; dim?: number }) {
  const id = useOS((s) => s.settings.wallpaper);
  const wp = wallpaperById(id);
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute transition-[filter,transform] duration-700"
        style={{
          inset: blur ? -40 : 0,
          background: wp.css,
          backgroundSize: "160px 160px, cover, cover, cover, cover, cover",
          filter: blur ? `blur(${blur}px) saturate(120%)` : undefined,
        }}
      />
      {dim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: dim }} />}
    </div>
  );
}
