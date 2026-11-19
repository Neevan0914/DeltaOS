// Minimal typing for Electron's <webview> element as used by DeltaOS.
export interface WebviewEl extends HTMLElement {
  src: string;
  loadURL(url: string): Promise<void>;
  getURL(): string;
  getTitle(): string;
  goBack(): void;
  goForward(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  reload(): void;
  stop(): void;
  isLoading(): boolean;
  getWebContentsId(): number;
  copy(): void;
  cut(): void;
  paste(): void;
  selectAll(): void;
  setZoomFactor(f: number): void;
  getZoomFactor(): number;
}

/** React's typings declare allowpopups as boolean, but Electron needs the string attribute. */
export const ALLOW_POPUPS = { allowpopups: "true" } as unknown as { allowpopups: boolean };

export const hasWebview = () => !!window.deltaos;

/**
 * Nudge a webview's size for two frames. Some Windows GPU setups stop painting a <webview> after it
 * navigates (electron/electron#18177); a layout change makes Chromium re-sync the guest surface.
 */
export function repaint(el: HTMLElement | null) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.style.width = "calc(100% - 1px)";
    requestAnimationFrame(() => {
      el.style.width = "";
    });
  });
}

/** Wrap an HTML document as a data: URL a webview can load. */
export const htmlToUrl = (html: string) => "data:text/html;charset=utf-8," + encodeURIComponent(html);
