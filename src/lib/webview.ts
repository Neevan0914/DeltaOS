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
