import { useState } from "react";
import { BatteryFull, ChevronUp, Search, Volume2, Wifi } from "lucide-react";
import { APPS, PINNED } from "../apps/registry";
import { setState, useOS, type AppId } from "../os/store";
import { taskbarActivate, TASKBAR_H, openApp, closeApp } from "../os/windows";
import { toggleAssistant } from "../os/assistant";
import { formatTime, useClock } from "../lib/useClock";
import { AppIcon } from "./AppIcon";
import { ClaudeMark, DeltaLogo } from "./Logo";
import { CalendarFlyout } from "./CalendarFlyout";
import { showContextMenu } from "../os/contextMenu";
import { X, Plus } from "lucide-react";

export function Taskbar() {
  const windows = useOS((s) => s.windows);
  const focusedId = useOS((s) => s.focusedId);
  const startOpen = useOS((s) => s.startOpen);
  const assistantOpen = useOS((s) => s.assistantOpen);
  const h24 = useOS((s) => s.settings.clock24);
  const now = useClock();
  const [calOpen, setCalOpen] = useState(false);

  const running = new Set(windows.filter((w) => !w.closing).map((w) => w.app));
  const apps: AppId[] = [...PINNED, ...[...running].filter((a) => !PINNED.includes(a))];
  const focusedApp = windows.find((w) => w.id === focusedId && !w.minimized)?.app;

  return (
    <>
      <div
        className="absolute inset-x-0 bottom-0 glass-panel !border-x-0 !border-b-0 flex items-center px-3 z-[9000]"
        style={{ height: TASKBAR_H }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <TaskButton
            label="Start"
            active={startOpen}
            onClick={() => setState((s) => ({ startOpen: !s.startOpen, assistantOpen: false }))}
            data-start-toggle
          >
            <DeltaLogo size={26} />
          </TaskButton>
          <TaskButton label="Search" onClick={() => setState({ startOpen: true, assistantOpen: false })} data-start-toggle>
            <Search size={20} className="text-fg" />
          </TaskButton>
          <div className="w-px h-6 bg-line mx-1.5" />
          {apps.map((app) => {
            const count = windows.filter((w) => w.app === app && !w.closing).length;
            return (
              <TaskButton
                key={app}
                label={APPS[app].title}
                onClick={() => taskbarActivate(app)}
                indicator={count ? (focusedApp === app ? "focused" : "running") : undefined}
                onContextMenu={(e) =>
                  showContextMenu(e, [
                    { label: `New ${APPS[app].title} window`, icon: Plus, onClick: () => openApp(app), disabled: APPS[app].singleton && count > 0 },
                    { separator: true },
                    { label: count > 1 ? "Close all windows" : "Close window", icon: X, disabled: !count, onClick: () => closeApp(app) },
                  ])
                }
              >
                <AppIcon app={app} size={30} />
              </TaskButton>
            );
          })}
          <div className="w-px h-6 bg-line mx-1.5" />
          <TaskButton label="Claude (Ctrl+Space)" active={assistantOpen} onClick={() => toggleAssistant()} data-assistant-toggle>
            <div
              className="w-[30px] h-[30px] rounded-[9px] grid place-items-center text-white"
              style={{
                background: "linear-gradient(135deg, #f0a27a 0%, #d97757 55%, #b9583c 100%)",
                boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.35), 0 4px 14px -4px #d97757",
              }}
            >
              <ClaudeMark size={17} />
            </div>
          </TaskButton>
        </div>
        <div className="flex-1 flex justify-end items-center gap-1">
          <button className="h-10 px-2 rounded-lg hover:bg-surface-2 text-muted" title="Show hidden icons">
            <ChevronUp size={16} />
          </button>
          <div className="h-10 px-2.5 rounded-lg hover:bg-surface-2 flex items-center gap-2.5 text-fg" title="Connected · Volume 80% · Battery 100%">
            <Wifi size={16} />
            <Volume2 size={16} />
            <BatteryFull size={18} />
          </div>
          <button
            data-calendar-toggle
            onClick={() => setCalOpen((v) => !v)}
            className={`h-10 px-3 rounded-lg flex flex-col items-end justify-center leading-tight transition-colors ${calOpen ? "bg-surface-2" : "hover:bg-surface-2"}`}
          >
            <span className="text-[12.5px] font-medium text-fg tabular-nums">{formatTime(now, h24)}</span>
            <span className="text-[11.5px] text-muted tabular-nums">{now.toLocaleDateString()}</span>
          </button>
          <button
            title="Show desktop"
            className="w-1.5 h-10 ml-1 rounded-sm hover:bg-surface-2 border-l border-line"
            onClick={() => setState((s) => ({ windows: s.windows.map((w) => ({ ...w, minimized: true })), focusedId: null }))}
          />
        </div>
      </div>
      {calOpen && <CalendarFlyout onClose={() => setCalOpen(false)} />}
    </>
  );
}

function TaskButton({
  children,
  label,
  onClick,
  active,
  indicator,
  onContextMenu,
  ...rest
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  indicator?: "running" | "focused";
  onContextMenu?: (e: React.MouseEvent) => void;
  [k: `data-${string}`]: unknown;
}) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`group relative w-11 h-11 rounded-xl grid place-items-center transition-all active:scale-90 ${
        active || indicator === "focused" ? "bg-surface-2" : "hover:bg-surface-2"
      }`}
    >
      <span className="transition-transform group-hover:-translate-y-px">{children}</span>
      {indicator && (
        <span
          className="absolute bottom-[3px] h-[3px] rounded-full transition-all"
          style={{
            width: indicator === "focused" ? 16 : 6,
            background: indicator === "focused" ? "var(--os-accent)" : "var(--os-muted)",
          }}
        />
      )}
    </button>
  );
}
