import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hideContextMenu, useContextMenu } from "../os/contextMenu";

export function ContextMenuHost() {
  const menu = useContextMenu();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(menu.x, window.innerWidth - r.width - 8),
      y: Math.min(menu.y, window.innerHeight - r.height - 8),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      hideContextMenu();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && hideContextMenu();
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", esc);
    window.addEventListener("blur", hideContextMenu);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", esc);
      window.removeEventListener("blur", hideContextMenu);
    };
  }, [menu]);

  if (!menu) return null;
  return (
    <div
      ref={ref}
      className="fixed z-[100000] min-w-[210px] p-1.5 rounded-xl glass-menu anim-pop-down text-fg"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 mx-2 h-px bg-line" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              hideContextMenu();
              item.onClick?.();
            }}
            className={`w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] text-left transition-colors disabled:opacity-35 ${
              item.danger ? "text-rose-400 hover:bg-rose-500/15" : "hover:bg-accent hover:text-accent-fg"
            }`}
          >
            {item.icon ? <item.icon size={15} className="opacity-80" /> : <span className="w-[15px]" />}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && <span className="text-[11px] opacity-50">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
