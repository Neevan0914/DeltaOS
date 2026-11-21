import { useEffect } from "react";
import { useOS, type Phase } from "../os/store";
import { openApp } from "../os/windows";
import { toggleAssistant } from "../os/assistant";
import { Wallpaper } from "./Wallpaper";
import { DesktopIcons } from "./DesktopIcons";
import { Window } from "./Window";
import { AppHost } from "./AppHost";
import { Taskbar } from "./Taskbar";
import { StartMenu } from "./StartMenu";
import { AssistantPanel } from "./AssistantPanel";

export function Desktop({ onPower }: { onPower: (p: Phase | "lock") => void }) {
  const windows = useOS((s) => s.windows);
  const startOpen = useOS((s) => s.startOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        toggleAssistant();
      } else if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        openApp("terminal");
      } else if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        openApp("files");
      }
    };
    window.addEventListener("keydown", onKey);
    // System shortcuts pressed while a web page has focus arrive from the main process.
    const off = window.deltaos?.onBrowserEvent((ev) => {
      // An App Store app followed a link to another site: open it in Tesseract.
      if (ev.type === "webapp-external") return void openApp("browser", { url: ev.url });
      if (ev.type !== "shortcut") return;
      if (ev.combo === "ctrl+space") toggleAssistant();
      if (ev.combo === "ctrl+alt+t") openApp("terminal");
      if (ev.combo === "ctrl+alt+e") openApp("files");
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      off?.();
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden anim-fade-in" onContextMenu={(e) => e.preventDefault()}>
      <Wallpaper />
      <DesktopIcons />
      {windows.map((w) => (
        <Window key={w.id} win={w}>
          <AppHost win={w} />
        </Window>
      ))}
      <Taskbar />
      {startOpen && <StartMenu onPower={onPower} />}
      <AssistantPanel />
    </div>
  );
}
