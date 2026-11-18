import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useClock, formatTime } from "../lib/useClock";
import { useOS } from "../os/store";
import { IconButton } from "./ui";

export function CalendarFlyout({ onClose }: { onClose: () => void }) {
  const now = useClock();
  const h24 = useOS((s) => s.settings.clock24);
  const [view, setView] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest("[data-calendar-toggle]")) return;
      onClose();
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [onClose]);

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startDay = first.getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const isToday = (d: number) =>
    d === now.getDate() && view.getMonth() === now.getMonth() && view.getFullYear() === now.getFullYear();

  return (
    <div ref={ref} className="absolute right-3 bottom-[64px] w-[330px] rounded-2xl glass-menu p-5 z-[9500] anim-pop-in text-fg">
      <div className="text-[34px] font-semibold tracking-tight tabular-nums">{formatTime(now, h24, true)}</div>
      <div className="text-[13px] text-muted">{now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
      <div className="h-px bg-line my-4" />
      <div className="flex items-center justify-between mb-2">
        <div className="text-[14px] font-semibold">{view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        <div className="flex">
          <IconButton onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
            <ChevronRight size={16} />
          </IconButton>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-faint mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="h-7 grid place-items-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-[12.5px]">
        {cells.map((d, i) => (
          <div key={i} className="h-9 grid place-items-center">
            {d && (
              <span
                className={`w-8 h-8 grid place-items-center rounded-full ${isToday(d) ? "bg-accent text-accent-fg font-semibold" : "hover:bg-surface-2"}`}
              >
                {d}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
