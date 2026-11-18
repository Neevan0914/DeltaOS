import { useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Minus, Square, X, Copy } from "lucide-react";
import { APPS } from "../apps/registry";
import { type WinState, useOS } from "../os/store";
import { closeWindow, focusWindow, minimizeWindow, snapWindow, toggleMaximize, updateWindow, viewport } from "../os/windows";
import { AppIcon } from "./AppIcon";

type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Snap = "left" | "right" | "max" | null;

export function Window({ win, children }: { win: WinState; children: ReactNode }) {
  const focused = useOS((s) => s.focusedId === win.id);
  const [interacting, setInteracting] = useState(false);
  const [snapPreview, setSnapPreview] = useState<Snap>(null);
  const ref = useRef<HTMLDivElement>(null);
  const meta = APPS[win.app];
  const fullBleed = win.maximized || !!win.snapped;

  const startDrag = (e: RPointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-nodrag]")) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let base = { x: win.x, y: win.y, w: win.w };
    let restored = !fullBleed;
    let moved = false;
    let snap: Snap = null;
    const vp = viewport();

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) {
        moved = true;
        setInteracting(true);
      }
      if (!restored) {
        // Pull a maximized/snapped window off the edge, keeping the cursor at the same relative spot.
        const r = win.restore ?? { x: win.x, y: win.y, w: win.w, h: win.h };
        const ratio = (startX - win.x) / win.w;
        base = { x: startX - r.w * ratio, y: 0, w: r.w };
        updateWindow(win.id, { ...r, x: base.x, y: base.y, maximized: false, snapped: null, restore: null });
        restored = true;
      }
      const x = Math.round(base.x + dx);
      const y = Math.round(Math.max(0, Math.min(vp.h - 36, base.y + dy)));
      updateWindow(win.id, { x, y });
      snap = ev.clientY <= 2 ? "max" : ev.clientX <= 2 ? "left" : ev.clientX >= window.innerWidth - 3 ? "right" : null;
      setSnapPreview(snap);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setInteracting(false);
      setSnapPreview(null);
      if (snap) snapWindow(win.id, snap);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (dir: Dir) => (e: RPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    focusWindow(win.id);
    const sx = e.clientX;
    const sy = e.clientY;
    const r0 = { x: win.x, y: win.y, w: win.w, h: win.h };
    const min = meta.minSize;
    setInteracting(true);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let { x, y, w, h } = r0;
      if (dir.includes("e")) w = Math.max(min.w, r0.w + dx);
      if (dir.includes("s")) h = Math.max(min.h, r0.h + dy);
      if (dir.includes("w")) {
        w = Math.max(min.w, r0.w - dx);
        x = r0.x + (r0.w - w);
      }
      if (dir.includes("n")) {
        h = Math.max(min.h, r0.h - dy);
        y = Math.max(0, r0.y + (r0.h - h));
        if (y === 0) h = r0.y + r0.h;
      }
      updateWindow(win.id, { x, y, w, h, maximized: false, snapped: null, restore: null });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setInteracting(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const vp = viewport();
  const minimizedStyle = win.minimized
    ? {
        opacity: 0,
        transform: `translate(${window.innerWidth / 2 - (win.x + win.w / 2)}px, ${vp.h + 40 - win.y}px) scale(0.2)`,
        pointerEvents: "none" as const,
      }
    : {};

  return (
    <>
      {snapPreview && (
        <div
          className="fixed rounded-2xl border-2 border-accent/60 bg-accent/15 backdrop-blur-sm transition-all duration-200 anim-fade-in"
          style={{
            zIndex: win.z - 1,
            left: snapPreview === "right" ? vp.w / 2 + 8 : 8,
            top: 8,
            width: snapPreview === "max" ? vp.w - 16 : vp.w / 2 - 16,
            height: vp.h - 16,
          }}
        />
      )}
      <div
        ref={ref}
        role="dialog"
        aria-label={win.title}
        data-window={win.app}
        className={`absolute flex flex-col overflow-hidden glass ${interacting ? "" : "win-transition"} ${
          win.closing ? "anim-win-close" : "anim-win-open"
        }`}
        style={{
          left: win.x,
          top: win.y,
          width: win.w,
          height: win.h,
          zIndex: win.z,
          borderRadius: win.maximized ? 0 : 14,
          boxShadow: focused
            ? "var(--os-shadow), 0 0 0 0.5px rgb(0 0 0 / 0.4)"
            : "0 18px 40px -18px rgb(0 0 0 / 0.5), 0 0 0 0.5px rgb(0 0 0 / 0.3)",
          ...minimizedStyle,
        }}
        onPointerDownCapture={() => focusWindow(win.id)}
      >
        {/* Title bar */}
        <div
          className="relative h-11 shrink-0 flex items-center gap-2.5 px-3.5 border-b border-line"
          onPointerDown={startDrag}
          onDoubleClick={(e) => {
            if (!(e.target as HTMLElement).closest("[data-nodrag]")) toggleMaximize(win.id);
          }}
        >
          <div className="flex items-center gap-2 group" data-nodrag>
            <TrafficLight color="#ff5f57" label="Close" onClick={() => closeWindow(win.id)} active={focused}>
              <X size={8} strokeWidth={3.5} />
            </TrafficLight>
            <TrafficLight color="#febc2e" label="Minimize" onClick={() => minimizeWindow(win.id)} active={focused}>
              <Minus size={8} strokeWidth={3.5} />
            </TrafficLight>
            <TrafficLight color="#28c840" label={fullBleed ? "Restore" : "Maximize"} onClick={() => toggleMaximize(win.id)} active={focused}>
              {fullBleed ? <Copy size={7} strokeWidth={3} /> : <Square size={7} strokeWidth={3} />}
            </TrafficLight>
          </div>
          <div
            className={`absolute inset-x-28 flex items-center justify-center gap-2 pointer-events-none transition-opacity ${
              focused ? "opacity-100" : "opacity-55"
            }`}
          >
            <AppIcon app={win.app} size={16} radius={4} />
            <span className="text-[12.5px] font-medium truncate text-fg">{win.title}</span>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 min-h-0">{children}</div>

        {/* Resize handles */}
        {!win.maximized && (
          <>
            <Handle dir="n" cls="top-0 inset-x-2 h-1.5 cursor-ns-resize" onDown={startResize} />
            <Handle dir="s" cls="bottom-0 inset-x-2 h-1.5 cursor-ns-resize" onDown={startResize} />
            <Handle dir="e" cls="right-0 inset-y-2 w-1.5 cursor-ew-resize" onDown={startResize} />
            <Handle dir="w" cls="left-0 inset-y-2 w-1.5 cursor-ew-resize" onDown={startResize} />
            <Handle dir="nw" cls="top-0 left-0 w-3 h-3 cursor-nwse-resize" onDown={startResize} />
            <Handle dir="ne" cls="top-0 right-0 w-3 h-3 cursor-nesw-resize" onDown={startResize} />
            <Handle dir="sw" cls="bottom-0 left-0 w-3 h-3 cursor-nesw-resize" onDown={startResize} />
            <Handle dir="se" cls="bottom-0 right-0 w-3 h-3 cursor-nwse-resize" onDown={startResize} />
          </>
        )}
      </div>
    </>
  );
}

function Handle({ dir, cls, onDown }: { dir: Dir; cls: string; onDown: (d: Dir) => (e: RPointerEvent) => void }) {
  return <div className={`absolute z-10 ${cls}`} onPointerDown={onDown(dir)} />;
}

function TrafficLight({
  color,
  label,
  onClick,
  children,
  active,
}: {
  color: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
  active: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-3.5 h-3.5 rounded-full grid place-items-center text-black/0 group-hover:text-black/60 transition-colors"
      style={{
        background: active ? color : "color-mix(in oklab, var(--os-text) 22%, transparent)",
        boxShadow: "inset 0 0 0 0.5px rgb(0 0 0 / 0.25)",
      }}
    >
      {children}
    </button>
  );
}
