import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, RotateCw, X, Plus, Lock, Globe, Search, Star, Home, MoreVertical, ZoomIn, ZoomOut, ExternalLink,
  Copy, Clipboard, Scissors, FileText, TextSelect, Link2, Image as ImageIcon, AlertTriangle, Check,
} from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { updateSettings, useOS, getState, type Bookmark } from "../os/store";
import { closeWindow, focusWindow, updateWindow } from "../os/windows";
import { showContextMenu, type MenuItem } from "../os/contextMenu";
import { toUrl } from "../os/open";
import { TesseractIcon } from "../components/TesseractIcon";
import { DownloadsButton } from "../components/DownloadsPanel";
import { ALLOW_POPUPS, hasWebview, htmlToUrl, repaint, type WebviewEl } from "../lib/webview";
import { basename, getNode, HOME, prettyPath, resolvePath } from "../os/vfs";

interface Tab {
  id: string;
  url: string; // "" = new tab page
  title: string;
  favicon: string | null;
  loading: boolean;
  canBack: boolean;
  canFwd: boolean;
  error: { code: number; desc: string; url: string; crashed?: boolean } | null;
  /** For pages rendered from a DeltaOS file (or unsaved HTML): what the address bar shows. */
  label?: string;
  filePath?: string;
}

let tabSeq = 0;
const newTab = (url = ""): Tab => ({
  id: `tab${++tabSeq}`,
  url,
  title: url ? hostOf(url) : "New Tab",
  favicon: null,
  loading: !!url,
  canBack: false,
  canFwd: false,
  error: null,
});

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

const ENGINES = { google: "Google", duckduckgo: "DuckDuckGo", bing: "Bing" } as const;

/** Resolve a DeltaOS path (~/Code/index.html) to a renderable page, or null if it isn't one. */
function filePage(input: string): { url: string; filePath: string; label: string } | null {
  const q = input.trim();
  if (!/^(~|\/)/.test(q)) return null;
  const path = resolvePath(HOME, q);
  const node = getNode(getState().fs, path);
  if (node?.type !== "file") return null;
  if (node.blob) {
    // Downloaded media is served from DeltaOS's private store by the main process.
    return { url: `deltaos-file://blob/${node.blob.id}/${encodeURIComponent(basename(path))}`, filePath: path, label: prettyPath(path) };
  }
  const isHtml = /\.html?$/i.test(path);
  const html = isHtml ? node.content : `<!doctype html><meta charset="utf-8"><title>${basename(path)}</title><pre style="font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;margin:16px">${node.content.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;
  return { url: htmlToUrl(html), filePath: path, label: prettyPath(path) };
}

function initialTab(props: Record<string, unknown>): Tab {
  if (props.file) {
    const page = filePage(String(props.file));
    if (page) return { ...newTab(page.url), title: basename(page.filePath), filePath: page.filePath, label: page.label };
  }
  if (props.html) return { ...newTab(htmlToUrl(String(props.html))), title: String(props.label ?? "Preview"), label: String(props.label ?? "Preview") };
  return newTab((props.url as string) || "");
}

export function Browser({ win }: AppProps) {
  const focused = useOS((s) => s.focusedId === win.id);
  const browser = useOS((s) => s.settings.browser);
  const [tabs, setTabs] = useState<Tab[]>(() => [initialTab(win.props)]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [addr, setAddr] = useState<string | null>(null); // non-null while editing
  const [zoom, setZoom] = useState<Record<string, number>>({});
  const views = useRef(new Map<string, WebviewEl>());
  const addrRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const patchTab = useCallback((id: string, patch: Partial<Tab>) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);

  useEffect(() => {
    updateWindow(win.id, { title: `${active.url ? active.title : "New Tab"} — Tesseract` });
  }, [active.title, active.url, win.id]);

  // URL pushed from elsewhere (e.g. Claude's open_url, `open https://…` in Terminal)
  const firstNonce = useRef(win.props.nonce);
  useEffect(() => {
    if (!win.props.nonce || win.props.nonce === firstNonce.current) return;
    if (win.props.file || win.props.html) {
      const t = initialTab(win.props);
      setTabs((ts) => [...ts, t]);
      setActiveId(t.id);
    } else if (win.props.url) openInNewTab(String(win.props.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props.nonce]);

  const navigate = (input: string, tabId = active.id) => {
    const page = filePage(input);
    const url = page?.url ?? toUrl(input, browser.search);
    if (!url) return;
    setAddr(null);
    const tab = tabs.find((t) => t.id === tabId);
    const view = views.current.get(tabId);
    const fileInfo = { filePath: page?.filePath, label: page?.label };
    if (tab?.url && view && !tab.error?.crashed) {
      patchTab(tabId, { error: null, ...fileInfo });
      void view.loadURL(url).catch(() => {});
    } else {
      // New tab page, or a crashed page: (re)create the webview.
      views.current.delete(tabId);
      patchTab(tabId, { url, title: page ? basename(page.filePath) : hostOf(url), loading: true, error: null, ...fileInfo });
    }
    setTimeout(() => views.current.get(tabId)?.focus(), 50);
  };

  const openInNewTab = (url = "", activate = true) => {
    const t = newTab(url ? toUrl(url, browser.search) : "");
    setTabs((ts) => [...ts, t]);
    if (activate) {
      setActiveId(t.id);
      setAddr(null);
      if (!url) setTimeout(() => addrRef.current?.focus(), 30);
    }
  };

  const closeTab = (id: string) => {
    views.current.delete(id);
    setTabs((ts) => {
      const idx = ts.findIndex((t) => t.id === id);
      const next = ts.filter((t) => t.id !== id);
      if (!next.length) {
        closeWindow(win.id);
        return ts;
      }
      if (id === activeId) setActiveId(next[Math.min(idx, next.length - 1)].id);
      return next;
    });
  };

  const goHome = () => {
    views.current.delete(active.id);
    patchTab(active.id, { url: "", title: "New Tab", favicon: null, loading: false, canBack: false, canFwd: false, error: null });
    setTimeout(() => addrRef.current?.focus(), 30);
  };

  const view = () => views.current.get(active.id);
  const reload = () => {
    if (active.filePath) return navigate(active.filePath); // re-read the file so edits show up
    if (active.error?.crashed) return navigate(active.error.url);
    view()?.reload();
  };
  const isBookmarked = !!active.url && browser.bookmarks.some((b) => b.url === active.url);
  const toggleBookmark = () => {
    if (!active.url) return;
    const bookmarks = isBookmarked
      ? browser.bookmarks.filter((b) => b.url !== active.url)
      : [...browser.bookmarks, { title: active.title || hostOf(active.url), url: active.url }];
    updateSettings({ browser: { ...browser, bookmarks } });
  };
  const setZoomFor = (factor: number) => {
    const f = Math.min(3, Math.max(0.3, Math.round(factor * 10) / 10));
    view()?.setZoomFactor(f);
    setZoom((z) => ({ ...z, [active.id]: f }));
  };

  const runShortcut = (combo: string) => {
    switch (combo) {
      case "ctrl+t": return openInNewTab();
      case "ctrl+w": return closeTab(active.id);
      case "ctrl+l": addrRef.current?.focus(); addrRef.current?.select(); return;
      case "ctrl+r": case "f5": return reload();
      case "alt+arrowleft": return view()?.goBack();
      case "alt+arrowright": return view()?.goForward();
      case "ctrl+d": return toggleBookmark();
      case "escape": return view()?.stop();
      case "ctrl+tab": case "ctrl+shift+tab": {
        const i = tabs.findIndex((t) => t.id === active.id);
        const n = tabs[(i + (combo === "ctrl+tab" ? 1 : tabs.length - 1)) % tabs.length];
        setActiveId(n.id);
        return;
      }
    }
  };
  const shortcutRef = useRef(runShortcut);
  shortcutRef.current = runShortcut;

  // Shortcuts typed while focus is in the browser chrome (address bar, tabs).
  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      const combo = [e.ctrlKey || e.metaKey ? "ctrl" : "", e.altKey ? "alt" : "", e.shiftKey ? "shift" : "", e.key.toLowerCase()].filter(Boolean).join("+");
      if (["ctrl+t", "ctrl+w", "ctrl+l", "ctrl+r", "f5", "alt+arrowleft", "alt+arrowright", "ctrl+tab", "ctrl+shift+tab", "ctrl+d"].includes(combo)) {
        e.preventDefault();
        shortcutRef.current(combo);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused]);

  // Events from guest pages (new windows, shortcuts, right-click), routed by guest id.
  useEffect(() => {
    if (!window.deltaos) return;
    return window.deltaos.onBrowserEvent((ev) => {
      let tabId: string | undefined;
      for (const [id, v] of views.current) {
        try {
          if (v.getWebContentsId() === ev.guestId) tabId = id;
        } catch {
          /* not attached yet */
        }
      }
      if (!tabId) return;
      if (ev.type === "open-tab") openInNewTab(ev.url);
      else if (ev.type === "shortcut") shortcutRef.current(ev.combo);
      else if (ev.type === "context-menu") {
        const v = views.current.get(tabId)!;
        const r = v.getBoundingClientRect();
        const items: MenuItem[] = [];
        if (ev.linkURL) {
          items.push(
            { label: "Open link in new tab", icon: ExternalLink, onClick: () => openInNewTab(ev.linkURL) },
            { label: "Copy link address", icon: Link2, onClick: () => void navigator.clipboard.writeText(ev.linkURL) },
            { separator: true },
          );
        }
        if (ev.srcURL) items.push({ label: "Open image in new tab", icon: ImageIcon, onClick: () => openInNewTab(ev.srcURL) }, { separator: true });
        if (ev.selectionText) {
          const snippet = ev.selectionText.length > 24 ? ev.selectionText.slice(0, 24) + "…" : ev.selectionText;
          items.push(
            { label: "Copy", icon: Copy, shortcut: "Ctrl+C", onClick: () => v.copy() },
            { label: `Search ${ENGINES[browser.search]} for “${snippet}”`, icon: Search, onClick: () => openInNewTab(ev.selectionText) },
            { separator: true },
          );
        }
        if (ev.isEditable) {
          items.push(
            { label: "Cut", icon: Scissors, onClick: () => v.cut() },
            { label: "Copy", icon: Copy, onClick: () => v.copy() },
            { label: "Paste", icon: Clipboard, onClick: () => v.paste() },
            { label: "Select all", icon: TextSelect, onClick: () => v.selectAll() },
            { separator: true },
          );
        }
        items.push(
          { label: "Back", icon: ArrowLeft, disabled: !v.canGoBack(), onClick: () => v.goBack() },
          { label: "Forward", icon: ArrowRight, disabled: !v.canGoForward(), onClick: () => v.goForward() },
          { label: "Reload", icon: RotateCw, onClick: () => v.reload() },
        );
        focusWindow(win.id);
        showContextMenu({ clientX: r.left + ev.x, clientY: r.top + ev.y, preventDefault() {}, stopPropagation() {} }, items);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, browser.search]);

  const menu = (e: React.MouseEvent) => {
    const z = zoom[active.id] ?? 1;
    showContextMenu({ clientX: e.clientX - 200, clientY: e.clientY + 14, preventDefault() {}, stopPropagation() {} }, [
      { label: "New tab", icon: Plus, shortcut: "Ctrl+T", onClick: () => openInNewTab() },
      { label: isBookmarked ? "Remove bookmark" : "Bookmark this page", icon: Star, shortcut: "Ctrl+D", disabled: !active.url, onClick: toggleBookmark },
      { separator: true },
      { label: `Zoom in (${Math.round(z * 100)}%)`, icon: ZoomIn, disabled: !active.url, onClick: () => setZoomFor(z + 0.1) },
      { label: "Zoom out", icon: ZoomOut, disabled: !active.url, onClick: () => setZoomFor(z - 0.1) },
      { label: "Reset zoom", icon: Search, disabled: !active.url || z === 1, onClick: () => setZoomFor(1) },
      { separator: true },
      ...(Object.keys(ENGINES) as (keyof typeof ENGINES)[]).map((k) => ({
        label: `Search with ${ENGINES[k]}`,
        icon: browser.search === k ? Check : undefined,
        onClick: () => updateSettings({ browser: { ...getState().settings.browser, search: k } }),
      })),
      { separator: true },
      { label: "Open in system browser", icon: ExternalLink, disabled: !active.url, onClick: () => window.open(active.url) },
    ]);
  };

  const local = (u: string) => u.startsWith("data:") || u.startsWith("deltaos-file:");
  const shownAddr = addr ?? (local(active.url) ? active.label ?? "Inline page" : active.url);
  const secure = active.url.startsWith("https://");

  return (
    <div ref={rootRef} className="absolute inset-0 flex flex-col text-fg">
      {/* Tab strip */}
      <div className="h-10 shrink-0 flex items-end gap-1 px-2 pt-1.5 bg-surface border-b border-line overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <div
            key={t.id}
            onPointerDown={(e) => e.button === 0 && setActiveId(t.id)}
            onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
            title={t.title}
            className={`group relative h-8 min-w-0 w-[200px] shrink flex items-center gap-2 pl-3 pr-1.5 rounded-t-lg text-[12.5px] transition-colors ${
              t.id === active.id ? "bg-win text-fg shadow-[0_-1px_0_var(--os-border)]" : "text-muted hover:bg-surface-2"
            }`}
          >
            <Favicon tab={t} />
            <span className="flex-1 truncate">{t.url ? t.title : "New Tab"}</span>
            <button
              aria-label="Close tab"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => closeTab(t.id)}
              className="w-5 h-5 shrink-0 rounded-md grid place-items-center opacity-60 hover:opacity-100 hover:bg-surface-2"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <button aria-label="New tab" onClick={() => openInNewTab()} className="mb-1 w-7 h-7 shrink-0 rounded-lg grid place-items-center text-muted hover:text-fg hover:bg-surface-2">
          <Plus size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="h-11 shrink-0 flex items-center gap-1 px-2 border-b border-line">
        <NavBtn label="Back" disabled={!active.canBack} onClick={() => view()?.goBack()}><ArrowLeft size={16} /></NavBtn>
        <NavBtn label="Forward" disabled={!active.canFwd} onClick={() => view()?.goForward()}><ArrowRight size={16} /></NavBtn>
        {active.loading ? (
          <NavBtn label="Stop" onClick={() => view()?.stop()}><X size={16} /></NavBtn>
        ) : (
          <NavBtn label="Reload" disabled={!active.url} onClick={reload}><RotateCw size={15} /></NavBtn>
        )}
        <NavBtn label="Home" onClick={goHome}><Home size={15} /></NavBtn>
        <form
          className="flex-1 min-w-0 mx-1"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(shownAddr);
            addrRef.current?.blur();
          }}
        >
          <div className="flex items-center h-8 rounded-full bg-input border border-line focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--os-accent)_25%,transparent)] transition-all px-3 gap-2">
            {active.filePath && addr === null ? (
              <FileText size={14} className="text-muted shrink-0" />
            ) : !active.url || addr !== null ? (
              <Search size={14} className="text-muted shrink-0" />
            ) : secure ? (
              <Lock size={13} className="text-emerald-400 shrink-0" />
            ) : (
              <Globe size={14} className="text-muted shrink-0" />
            )}
            <input
              ref={addrRef}
              value={shownAddr}
              spellCheck={false}
              aria-label="Address"
              placeholder={`Search ${ENGINES[browser.search]} or type a URL`}
              onChange={(e) => setAddr(e.target.value)}
              onFocus={(e) => {
                setAddr(shownAddr);
                requestAnimationFrame(() => e.target.select());
              }}
              onBlur={() => setAddr(null)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAddr(null);
                  e.currentTarget.blur();
                }
              }}
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-faint"
            />
            {active.url && (
              <button type="button" aria-label="Bookmark" onClick={toggleBookmark} className="shrink-0 text-muted hover:text-fg">
                <Star size={15} className={isBookmarked ? "fill-amber-400 text-amber-400" : ""} />
              </button>
            )}
          </div>
        </form>
        <DownloadsButton />
        <NavBtn label="Menu" onClick={menu}><MoreVertical size={16} /></NavBtn>
      </div>

      {/* Bookmarks bar */}
      {browser.bookmarks.length > 0 && (
        <div className="h-8 shrink-0 flex items-center gap-0.5 px-2 border-b border-line overflow-x-auto no-scrollbar">
          {browser.bookmarks.map((b) => (
            <button
              key={b.url}
              onClick={() => navigate(b.url)}
              onContextMenu={(e) =>
                showContextMenu(e, [
                  { label: "Open in new tab", icon: ExternalLink, onClick: () => openInNewTab(b.url) },
                  { label: "Remove bookmark", icon: X, danger: true, onClick: () => updateSettings({ browser: { ...browser, bookmarks: browser.bookmarks.filter((x) => x.url !== b.url) } }) },
                ])
              }
              className="h-6 px-2 shrink-0 rounded-md flex items-center gap-1.5 text-[12px] text-muted hover:text-fg hover:bg-surface-2 max-w-[180px]"
            >
              <SiteIcon url={b.url} size={14} />
              <span className="truncate">{b.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className={`relative flex-1 min-h-0 ${active.url && !active.error ? "bg-white" : ""}`}>
        {active.loading && (
          <div className="absolute top-0 inset-x-0 h-[2px] z-20 overflow-hidden">
            <div className="h-full w-1/3 bg-accent" style={{ animation: "browser-progress 1.1s ease-in-out infinite" }} />
          </div>
        )}
        {tabs.map((t) =>
          t.url ? (
            // A crashed page's webview is dropped; "Try again" mounts a fresh one.
            !t.error?.crashed && <Guest
              key={t.id}
              tab={t}
              active={t.id === active.id}
              register={(el) => (el ? views.current.set(t.id, el) : views.current.delete(t.id))}
              patch={(p) => patchTab(t.id, p)}
            />
          ) : (
            t.id === active.id && <NewTabPage key={t.id} engine={ENGINES[browser.search]} bookmarks={browser.bookmarks} onGo={(q) => navigate(q, t.id)} />
          ),
        )}
        {active.url && active.error && (
          <div className="absolute inset-0 z-10 grid place-items-center text-fg">
            <div className="max-w-md text-center px-6">
              <div className="w-14 h-14 mx-auto rounded-2xl grid place-items-center bg-amber-400/15 text-amber-400 mb-4">
                <AlertTriangle size={28} />
              </div>
              <div className="text-[18px] font-semibold">{active.error.crashed ? "This page crashed" : "This page couldn't be loaded"}</div>
              <div className="text-[13px] text-muted mt-2 break-all">
                {active.label ?? hostOf(active.error.url)} · {active.error.desc}
              </div>
              <button onClick={() => { const crashed = active.error?.crashed; patchTab(active.id, { error: null }); if (crashed || active.filePath) reload(); else view()?.reload(); }} className="mt-5 h-8 px-4 rounded-lg bg-accent text-accent-fg text-[13px] font-medium">
                Try again
              </button>
            </div>
          </div>
        )}
        {!hasWebview() && active.url && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-win text-muted text-[13px]">Web pages load in the DeltaOS desktop app.</div>
        )}
        {/* While another window is focused, the first click focuses this one instead of the page. */}
        {!focused && <div className="absolute inset-0 z-30" onPointerDown={() => focusWindow(win.id)} />}
      </div>
    </div>
  );
}

function Guest({ tab, active, register, patch }: { tab: Tab; active: boolean; register: (el: WebviewEl | null) => void; patch: (p: Partial<Tab>) => void }) {
  const ref = useRef<WebviewEl>(null);
  const [initialSrc] = useState(tab.url);
  const patchRef = useRef(patch);
  patchRef.current = patch;

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasWebview()) return;
    register(el);
    const nav = () => {
      try {
        const url = el.getURL();
        patchRef.current({
          url,
          canBack: el.canGoBack(),
          canFwd: el.canGoForward(),
          ...(url.startsWith("data:") || url.startsWith("deltaos-file:") ? {} : { filePath: undefined, label: undefined }),
        });
      } catch {
        /* guest not ready */
      }
    };
    const handlers: Record<string, (e: Event & Record<string, unknown>) => void> = {
      "did-start-loading": () => patchRef.current({ loading: true, error: null }),
      "did-stop-loading": () => {
        patchRef.current({ loading: false });
        nav();
      },
      "did-navigate": () => {
        nav();
        repaint(el);
      },
      "dom-ready": () => repaint(el),
      "did-finish-load": () => repaint(el),
      "render-process-gone": (e) => {
        const reason = String((e as unknown as { details?: { reason?: string } }).details?.reason ?? e.reason ?? "unknown");
        window.deltaos?.log(`tesseract tab crashed: ${reason}`);
        patchRef.current({ loading: false, error: { code: -1000, desc: `The page's process stopped (${reason}).`, url: el.getURL?.() || "", crashed: true } });
      },
      "did-navigate-in-page": (e) => e.isMainFrame !== false && nav(),
      "page-title-updated": (e) => patchRef.current({ title: String(e.title) }),
      "page-favicon-updated": (e) => patchRef.current({ favicon: (e.favicons as string[])?.[0] ?? null }),
      "did-fail-load": (e) => {
        if (e.isMainFrame === false || e.errorCode === -3) return; // -3 = aborted (e.g. new navigation)
        patchRef.current({ loading: false, error: { code: Number(e.errorCode), desc: String(e.errorDescription || "Network error"), url: String(e.validatedURL) } });
      },
    };
    for (const [name, h] of Object.entries(handlers)) el.addEventListener(name, h as EventListener);
    return () => {
      for (const [name, h] of Object.entries(handlers)) el.removeEventListener(name, h as EventListener);
      register(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active) repaint(ref.current);
  }, [active]);

  if (!hasWebview()) return null;
  return (
    <webview
      ref={ref as React.Ref<HTMLElement>}
      src={initialSrc}
      partition="persist:tesseract"
      {...ALLOW_POPUPS}
      className="absolute inset-0"
      style={{ visibility: active ? "visible" : "hidden", pointerEvents: active ? undefined : "none" }}
    />
  );
}

function NewTabPage({ engine, bookmarks, onGo }: { engine: string; bookmarks: Bookmark[]; onGo: (q: string) => void }) {
  const [q, setQ] = useState("");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="absolute inset-0 overflow-y-auto text-fg">
      <div
        className="absolute inset-x-0 top-0 h-80 pointer-events-none opacity-60"
        style={{ background: "radial-gradient(ellipse 60% 70% at 50% 0%, color-mix(in oklab, var(--os-accent) 45%, transparent), transparent 70%)" }}
      />
      <div className="relative max-w-[640px] mx-auto px-6 pt-[12vh] pb-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl grid place-items-center text-white shadow-lg" style={{ background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 55%, #7c3aed 100%)" }}>
          <TesseractIcon size={36} strokeWidth={1.7} />
        </div>
        <div className="mt-4 text-[28px] font-semibold tracking-tight">Tesseract</div>
        <div className="text-[13px] text-muted">{greeting} — where to?</div>
        <form
          className="w-full mt-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) onGo(q);
          }}
        >
          <div className="flex items-center h-12 rounded-full bg-input border border-line focus-within:border-accent px-5 gap-3 shadow-sm transition-colors">
            <Search size={18} className="text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${engine} or type a URL`} className="flex-1 bg-transparent outline-none text-[14.5px] placeholder:text-faint" />
          </div>
        </form>
        {bookmarks.length > 0 && (
          <div className="w-full grid grid-cols-4 sm:grid-cols-6 gap-2 mt-9">
            {bookmarks.slice(0, 12).map((b) => (
              <button key={b.url} onClick={() => onGo(b.url)} className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-surface-2 transition-colors min-w-0">
                <div className="w-12 h-12 rounded-2xl grid place-items-center bg-surface border border-line">
                  <SiteIcon url={b.url} size={24} />
                </div>
                <span className="text-[11.5px] text-muted truncate max-w-full">{b.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TILE_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#0ea5e9"];

function SiteIcon({ url, size }: { url: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const host = useMemo(() => hostOf(url), [url]);
  const src = useMemo(() => {
    try {
      return new URL("/favicon.ico", url).href;
    } catch {
      return "";
    }
  }, [url]);
  if (failed || !src || !hasWebview()) {
    const color = TILE_COLORS[[...host].reduce((a, c) => a + c.charCodeAt(0), 0) % TILE_COLORS.length];
    return (
      <span className="rounded-md grid place-items-center text-white font-semibold shrink-0" style={{ width: size, height: size, fontSize: size * 0.55, background: color }}>
        {host[0]?.toUpperCase() ?? "?"}
      </span>
    );
  }
  return <img src={src} width={size} height={size} alt="" className="shrink-0 rounded-sm" onError={() => setFailed(true)} />;
}

function Favicon({ tab }: { tab: Tab }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [tab.favicon]);
  if (tab.loading) return <span className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-accent/30 border-t-accent" style={{ animation: "spin-slow 0.8s linear infinite" }} />;
  if (!tab.url) return <TesseractIcon size={14} className="shrink-0 text-accent" />;
  if (tab.favicon && !failed) return <img src={tab.favicon} width={14} height={14} alt="" className="shrink-0" onError={() => setFailed(true)} />;
  return <Globe size={14} className="shrink-0" />;
}

function NavBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}
