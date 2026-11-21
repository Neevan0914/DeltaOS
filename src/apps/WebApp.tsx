import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Home, RotateCw, Copy, WifiOff, ExternalLink } from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { getState, useOS } from "../os/store";
import { focusWindow, openApp, toggleMaximize, updateWindow } from "../os/windows";
import { showContextMenu, type MenuItem } from "../os/contextMenu";
import { ALLOW_POPUPS, hasWebview, repaint, type WebviewEl } from "../lib/webview";
import { webAppById, WEB_APP_LOOK } from "../os/webapps";
import { webAppPartition } from "../../shared/webapps";

/**
 * An installed App Store app: one web app in its own window, with its own sign-in and storage and
 * no browser controls. Links to other sites open in Tesseract (enforced in the main process).
 */
export function WebApp({ win }: AppProps) {
  const id = String(win.props.webapp ?? "");
  const def = webAppById(id);
  const look = WEB_APP_LOOK[id];
  const focused = useOS((s) => s.focusedId === win.id);
  const ref = useRef<WebviewEl>(null);
  const [ready, setReady] = useState(false); // session prepared in the main process
  const [firstLoad, setFirstLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atHome, setAtHome] = useState(true);
  const [canBack, setCanBack] = useState(false);
  const [webviewKey, setWebviewKey] = useState(0);
  const maximizedForFullscreen = useRef(false);

  useEffect(() => {
    if (def) updateWindow(win.id, { title: def.name });
    if (def && window.deltaos) void window.deltaos.webapps.prepare(id).then(setReady);
  }, [id, def, win.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready || !def) return;
    const home = new URL(def.url);
    const sync = () => {
      try {
        const u = new URL(el.getURL());
        setAtHome(u.hostname === home.hostname && u.pathname === home.pathname);
        setCanBack(el.canGoBack());
      } catch {
        /* not attached yet */
      }
    };
    const handlers: Record<string, (e: Event & Record<string, unknown>) => void> = {
      "did-start-loading": () => { setLoading(true); setError(null); },
      "did-stop-loading": () => { setLoading(false); sync(); },
      "did-navigate": () => { sync(); repaint(el); },
      "did-navigate-in-page": (e) => e.isMainFrame !== false && sync(),
      "dom-ready": () => { setFirstLoad(false); repaint(el); },
      "did-finish-load": () => repaint(el),
      "did-fail-load": (e) => {
        if (e.isMainFrame === false || e.errorCode === -3) return;
        setLoading(false);
        setError(String(e.errorDescription || "Network error"));
      },
      "render-process-gone": () => { setLoading(false); setError("The app stopped unexpectedly."); },
      "enter-html-full-screen": () => {
        const w = getState().windows.find((x) => x.id === win.id);
        if (w && !w.maximized) { maximizedForFullscreen.current = true; toggleMaximize(win.id); }
      },
      "leave-html-full-screen": () => {
        if (maximizedForFullscreen.current) { maximizedForFullscreen.current = false; toggleMaximize(win.id); }
      },
    };
    for (const [n, h] of Object.entries(handlers)) el.addEventListener(n, h as EventListener);
    return () => {
      for (const [n, h] of Object.entries(handlers)) el.removeEventListener(n, h as EventListener);
    };
  }, [ready, webviewKey, def, win.id]);

  const goHome = () => { setError(null); if (def) void ref.current?.loadURL(def.url).catch(() => {}); };
  const reload = () => {
    if (error) { setError(null); setFirstLoad(true); setWebviewKey((k) => k + 1); return; }
    ref.current?.reload();
  };
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!window.deltaos) return;
    return window.deltaos.onBrowserEvent((ev) => {
      let gid: number | undefined;
      try { gid = ref.current?.getWebContentsId(); } catch { /* not attached */ }
      if (gid === undefined || ev.guestId !== gid) return;
      const v = ref.current!;
      if (ev.type === "shortcut") {
        if (ev.combo === "ctrl+r" || ev.combo === "f5") reloadRef.current();
        if (ev.combo === "alt+arrowleft" && v.canGoBack()) v.goBack();
        if (ev.combo === "alt+arrowright" && v.canGoForward()) v.goForward();
      } else if (ev.type === "context-menu") {
        const r = v.getBoundingClientRect();
        const items: MenuItem[] = [];
        if (ev.linkURL) items.push({ label: "Open link in Tesseract", icon: ExternalLink, onClick: () => openApp("browser", { url: ev.linkURL }) }, { separator: true });
        if (ev.selectionText) items.push({ label: "Copy", icon: Copy, onClick: () => v.copy() }, { separator: true });
        items.push(
          { label: "Back", icon: ArrowLeft, disabled: !v.canGoBack(), onClick: () => v.goBack() },
          { label: "Forward", icon: ArrowRight, disabled: !v.canGoForward(), onClick: () => v.goForward() },
          { label: "Reload", icon: RotateCw, onClick: () => reloadRef.current() },
          { label: `${def?.name ?? "App"} home`, icon: Home, onClick: goHome },
          { separator: true },
          { label: "Open this page in Tesseract", icon: ExternalLink, onClick: () => openApp("browser", { url: v.getURL() }) },
        );
        focusWindow(win.id);
        showContextMenu({ clientX: r.left + ev.x, clientY: r.top + ev.y, preventDefault() {}, stopPropagation() {} }, items);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.id, def]);

  if (!def) {
    return <div className="absolute inset-0 grid place-items-center text-muted text-[13px]">This app is no longer available.</div>;
  }
  const Icon = look?.icon;

  return (
    <div className="absolute inset-0 bg-[#111217] overflow-hidden" data-webapp={id}>
      {hasWebview() && ready && (
        <webview
          key={webviewKey}
          ref={ref as React.Ref<HTMLElement>}
          src={def.url}
          partition={webAppPartition(id)}
          {...ALLOW_POPUPS}
          className="absolute inset-0"
          style={{ visibility: error ? "hidden" : "visible" }}
        />
      )}

      {!firstLoad && !error && (!atHome || canBack) && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-0.5 p-1 rounded-full bg-black/55 backdrop-blur-xl border border-white/15 shadow-lg anim-pop-in">
          <PillBtn label="Back" disabled={!canBack} onClick={() => ref.current?.goBack()}><ArrowLeft size={15} /></PillBtn>
          <PillBtn label={`${def.name} home`} onClick={goHome}><Home size={14} /></PillBtn>
        </div>
      )}

      {!firstLoad && loading && !error && (
        <div className="absolute top-0 inset-x-0 h-[2px] z-20 overflow-hidden">
          <div className="h-full w-1/3 bg-accent" style={{ animation: "browser-progress 1.1s ease-in-out infinite" }} />
        </div>
      )}

      {(firstLoad || !hasWebview()) && !error && (
        <div className="absolute inset-0 z-10 grid place-items-center text-white" style={{ background: "radial-gradient(ellipse at 50% 40%, #1f2937 0%, #0b0b10 70%)" }}>
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-[22px] grid place-items-center shadow-2xl anim-glow" style={{ background: look?.gradient }}>
              {Icon && <Icon size={40} strokeWidth={1.8} />}
            </div>
            <div className="mt-5 text-[20px] font-semibold tracking-tight">{def.name}</div>
            <div className="text-[12.5px] text-white/50 mt-1">{hasWebview() ? "Starting…" : "Apps run in the DeltaOS desktop app."}</div>
            {hasWebview() && <div className="mt-6 w-6 h-6 rounded-full border-2 border-white/15 border-t-white/80" style={{ animation: "spin-slow 0.8s linear infinite" }} />}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 grid place-items-center text-white bg-[#111217]">
          <div className="text-center px-6 max-w-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl grid place-items-center bg-white/10 mb-4"><WifiOff size={26} /></div>
            <div className="text-[18px] font-semibold">Can't reach {def.name}</div>
            <div className="text-[13px] text-white/55 mt-2">{error}</div>
            <button onClick={reload} className="mt-5 h-9 px-5 rounded-full bg-accent text-accent-fg hover:brightness-110 text-[13px] font-medium">Try again</button>
          </div>
        </div>
      )}

      {!focused && <div className="absolute inset-0 z-30" onPointerDown={() => focusWindow(win.id)} />}
    </div>
  );
}

function PillBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="w-7 h-7 rounded-full grid place-items-center text-white/85 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors">
      {children}
    </button>
  );
}
