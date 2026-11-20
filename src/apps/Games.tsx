import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Home, RotateCw, Copy, Gamepad2, WifiOff, ShieldAlert } from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { getState, useOS } from "../os/store";
import { focusWindow, toggleMaximize } from "../os/windows";
import { showContextMenu, type MenuItem } from "../os/contextMenu";
import { ALLOW_POPUPS, hasWebview, repaint, type WebviewEl } from "../lib/webview";
import { GAMES_HOME, GAMES_PARTITION } from "../../shared/games";

/**
 * Games: the Anyware Studios itch.io page as a standalone app — no address bar, no tabs.
 * The main process refuses any navigation that leaves anyware-studios.itch.io.
 */
export function Games({ win }: AppProps) {
  const focused = useOS((s) => s.focusedId === win.id);
  const ref = useRef<WebviewEl>(null);
  const [firstLoad, setFirstLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(GAMES_HOME);
  const [canBack, setCanBack] = useState(false);
  const [canFwd, setCanFwd] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [webviewKey, setWebviewKey] = useState(0);
  const maximizedForFullscreen = useRef(false);
  const blockedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const atHome = url.replace(/\/$/, "") === GAMES_HOME.replace(/\/$/, "");

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasWebview()) return;
    const sync = () => {
      try {
        setUrl(el.getURL());
        setCanBack(el.canGoBack());
        setCanFwd(el.canGoForward());
      } catch {
        /* not attached yet */
      }
    };
    const handlers: Record<string, (e: Event & Record<string, unknown>) => void> = {
      "did-start-loading": () => {
        setLoading(true);
        setError(null);
      },
      "did-stop-loading": () => {
        setLoading(false);
        sync();
      },
      "did-navigate": () => {
        sync();
        repaint(el);
      },
      "did-navigate-in-page": (e) => e.isMainFrame !== false && sync(),
      "dom-ready": () => {
        setFirstLoad(false);
        repaint(el);
      },
      "did-finish-load": () => repaint(el),
      "did-fail-load": (e) => {
        if (e.isMainFrame === false || e.errorCode === -3) return;
        setLoading(false);
        setError(String(e.errorDescription || "Network error"));
      },
      "render-process-gone": () => {
        setLoading(false);
        setError("The game page stopped unexpectedly.");
        window.deltaos?.log("games: page crashed");
      },
      // A game asking for full screen gets the whole DeltaOS screen area.
      "enter-html-full-screen": () => {
        const w = getState().windows.find((x) => x.id === win.id);
        if (w && !w.maximized) {
          maximizedForFullscreen.current = true;
          toggleMaximize(win.id);
        }
      },
      "leave-html-full-screen": () => {
        if (maximizedForFullscreen.current) {
          maximizedForFullscreen.current = false;
          toggleMaximize(win.id);
        }
      },
    };
    for (const [n, h] of Object.entries(handlers)) el.addEventListener(n, h as EventListener);
    return () => {
      for (const [n, h] of Object.entries(handlers)) el.removeEventListener(n, h as EventListener);
    };
  }, [webviewKey, win.id]);

  const guestId = () => {
    try {
      return ref.current?.getWebContentsId();
    } catch {
      return undefined;
    }
  };

  const goHome = () => {
    setError(null);
    void ref.current?.loadURL(GAMES_HOME).catch(() => {});
  };
  const reload = () => {
    if (error) {
      // After a crash or failed first load, start over with a fresh view.
      setError(null);
      setFirstLoad(true);
      setWebviewKey((k) => k + 1);
      return;
    }
    ref.current?.reload();
  };
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  // Events from the page: blocked links, shortcuts, right-click.
  useEffect(() => {
    if (!window.deltaos) return;
    return window.deltaos.onBrowserEvent((ev) => {
      if (ev.guestId !== guestId()) return;
      const v = ref.current!;
      if (ev.type === "games-blocked") {
        setBlocked(true);
        clearTimeout(blockedTimer.current);
        blockedTimer.current = setTimeout(() => setBlocked(false), 2800);
      } else if (ev.type === "shortcut") {
        if (ev.combo === "ctrl+r" || ev.combo === "f5") reloadRef.current();
        if (ev.combo === "alt+arrowleft" && v.canGoBack()) v.goBack();
        if (ev.combo === "alt+arrowright" && v.canGoForward()) v.goForward();
      } else if (ev.type === "context-menu") {
        const r = v.getBoundingClientRect();
        const items: MenuItem[] = [];
        if (ev.selectionText) items.push({ label: "Copy", icon: Copy, onClick: () => v.copy() }, { separator: true });
        items.push(
          { label: "Back", icon: ArrowLeft, disabled: !v.canGoBack(), onClick: () => v.goBack() },
          { label: "Forward", icon: ArrowRight, disabled: !v.canGoForward(), onClick: () => v.goForward() },
          { label: "Reload", icon: RotateCw, onClick: () => reloadRef.current() },
          { label: "Anyware Studios home", icon: Home, onClick: goHome },
        );
        focusWindow(win.id);
        showContextMenu({ clientX: r.left + ev.x, clientY: r.top + ev.y, preventDefault() {}, stopPropagation() {} }, items);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.id]);

  return (
    <div className="absolute inset-0 bg-[#0e0e14] overflow-hidden" data-games>
      {hasWebview() ? (
        <webview
          key={webviewKey}
          ref={ref as React.Ref<HTMLElement>}
          src={GAMES_HOME}
          partition={GAMES_PARTITION}
          {...ALLOW_POPUPS}
          className="absolute inset-0"
          style={{ visibility: error ? "hidden" : "visible" }}
        />
      ) : null}

      {/* Back / home: only once you've left the studio page */}
      {!firstLoad && !error && (!atHome || canFwd) && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-0.5 p-1 rounded-full bg-black/55 backdrop-blur-xl border border-white/15 shadow-lg anim-pop-in">
          <PillBtn label="Back" disabled={!canBack} onClick={() => ref.current?.goBack()}><ArrowLeft size={15} /></PillBtn>
          <PillBtn label="Anyware Studios home" onClick={goHome}><Home size={14} /></PillBtn>
        </div>
      )}

      {/* Thin loading bar after the first load */}
      {!firstLoad && loading && !error && (
        <div className="absolute top-0 inset-x-0 h-[2px] z-20 overflow-hidden">
          <div className="h-full w-1/3 bg-[#fa5c5c]" style={{ animation: "browser-progress 1.1s ease-in-out infinite" }} />
        </div>
      )}

      {/* Splash while the page first loads */}
      {(firstLoad || !hasWebview()) && !error && (
        <div className="absolute inset-0 z-10 grid place-items-center text-white" style={{ background: "radial-gradient(ellipse at 50% 40%, #1f2937 0%, #0b0b10 70%)" }}>
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-[22px] grid place-items-center shadow-2xl anim-glow" style={{ background: "linear-gradient(135deg, #a3e635 0%, #16a34a 100%)" }}>
              <Gamepad2 size={42} strokeWidth={1.8} />
            </div>
            <div className="mt-5 text-[20px] font-semibold tracking-tight">Anyware Studios</div>
            <div className="text-[12.5px] text-white/50 mt-1">{hasWebview() ? "Loading games…" : "Games run in the DeltaOS desktop app."}</div>
            {hasWebview() && <div className="mt-6 w-6 h-6 rounded-full border-2 border-white/15 border-t-white/80" style={{ animation: "spin-slow 0.8s linear infinite" }} />}
          </div>
        </div>
      )}

      {/* Offline / crashed */}
      {error && (
        <div className="absolute inset-0 z-10 grid place-items-center text-white bg-[#0e0e14]">
          <div className="text-center px-6 max-w-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl grid place-items-center bg-white/10 mb-4">
              <WifiOff size={26} />
            </div>
            <div className="text-[18px] font-semibold">Can't reach Anyware Studios</div>
            <div className="text-[13px] text-white/55 mt-2">{error}</div>
            <button onClick={reload} className="mt-5 h-9 px-5 rounded-full bg-[#16a34a] hover:brightness-110 text-[13px] font-medium">
              Try again
            </button>
          </div>
        </div>
      )}

      {/* "That link leaves Anyware Studios" notice */}
      {blocked && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-black/75 backdrop-blur-xl border border-white/15 text-white text-[12.5px] shadow-lg anim-pop-in">
          <ShieldAlert size={14} className="text-amber-300" />
          Games only shows Anyware Studios pages
        </div>
      )}

      {!focused && <div className="absolute inset-0 z-30" onPointerDown={() => focusWindow(win.id)} />}
    </div>
  );
}

function PillBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="w-7 h-7 rounded-full grid place-items-center text-white/85 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}

