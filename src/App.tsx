import { useCallback, useEffect, useState } from "react";
import { getState, loadPersisted, persistNow, setState, useOS, type Phase } from "./os/store";
import { accentForeground } from "./os/theme";
import { BootScreen } from "./components/BootScreen";
import { LoginScreen } from "./components/LoginScreen";
import { Desktop } from "./components/Desktop";
import { Toasts } from "./components/Toasts";
import { ContextMenuHost } from "./components/ContextMenuHost";
import { DeltaLogo } from "./components/Logo";
import { openApp } from "./os/windows";
import { refreshStatus } from "./os/assistant";

export function App() {
  const phase = useOS((s) => s.phase);
  const settings = useOS((s) => s.settings);
  const [firstLogin, setFirstLogin] = useState(true);

  useEffect(() => {
    void loadPersisted();
    void refreshStatus();
  }, []);

  // Apply theme tokens to the document root.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.transparency = settings.transparency ? "on" : "off";
    root.dataset.animations = settings.animations ? "on" : "off";
    root.style.setProperty("--os-accent", settings.accent);
    root.style.setProperty("--os-accent-fg", accentForeground(settings.accent));
  }, [settings.theme, settings.transparency, settings.animations, settings.accent]);

  const onPower = useCallback((p: Phase | "lock") => {
    persistNow();
    if (p === "lock") {
      setState({ phase: "login", startOpen: false, assistantOpen: false });
      return;
    }
    setState({ phase: p, startOpen: false, assistantOpen: false });
    setTimeout(() => {
      if (p === "shutdown") {
        if (window.deltaos) window.deltaos.quit();
      } else if (p === "restart") {
        setState({ windows: [], focusedId: null, phase: "boot" });
      }
    }, 1900);
  }, []);

  const finishBoot = useCallback(() => {
    const go = () => (getState().loaded ? setState({ phase: "login" }) : setTimeout(go, 50));
    go();
  }, []);

  const onLogin = useCallback(() => {
    setState({ phase: "desktop" });
    if (firstLogin) {
      setFirstLogin(false);
      if (getState().windows.length === 0) {
        setTimeout(() => openApp("editor", { path: "/home/user/Desktop/Welcome.md" }), 450);
      }
    }
  }, [firstLogin]);

  return (
    <div className="absolute inset-0 select-none">
      {phase === "boot" && <BootScreen onDone={finishBoot} />}
      {phase === "login" && <LoginScreen onLogin={onLogin} onPower={onPower} />}
      {phase === "desktop" && <Desktop onPower={onPower} />}
      {(phase === "shutdown" || phase === "restart") && <PowerScreen kind={phase} />}
      <Toasts />
      <ContextMenuHost />
    </div>
  );
}

function PowerScreen({ kind }: { kind: "shutdown" | "restart" }) {
  return (
    <div className="absolute inset-0 bg-[#030306] grid place-items-center text-white anim-fade-in z-[100001]">
      <div className="flex flex-col items-center gap-6">
        <DeltaLogo size={64} className="anim-glow" />
        <div className="w-7 h-7 rounded-full border-2 border-white/20 border-t-white" style={{ animation: "spin-slow 0.9s linear infinite" }} />
        <div className="text-[14px] text-white/60">{kind === "shutdown" ? "Shutting down…" : "Restarting…"}</div>
      </div>
    </div>
  );
}
