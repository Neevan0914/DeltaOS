import { useEffect, useRef, useState } from "react";
import { transform } from "sucrase";
import { hasWebview, htmlToUrl, repaint, type WebviewEl } from "../lib/webview";

export interface OutputLine {
  kind: "log" | "info" | "warn" | "error" | "system";
  text: string;
}

// Formats console arguments (objects as JSON) before they reach the console-message event.
const SHIM = `<script>(()=>{const f=a=>{if(typeof a==="string")return a;if(a instanceof Error)return a.stack||String(a);try{const s=JSON.stringify(a,null,2);return s===undefined?String(a):s}catch{return String(a)}};
for(const k of ["log","info","warn","error","debug"]){const o=console[k].bind(console);console[k]=(...a)=>o(a.map(f).join(" "))}})();</script>`;

/** Builds a sandboxed page that runs the program as a module script. */
export function buildRunDocument(code: string, lang: "js" | "ts"): { html: string; lineOffset: number } {
  const js = lang === "ts" ? transform(code, { transforms: ["typescript"], disableESTransforms: true }).code : code;
  const prefix = `<!doctype html><meta charset="utf-8">${SHIM}<script type="module">\n`;
  return { html: prefix + js.replace(/<\/script/gi, "<\\/script") + "\n</script>", lineOffset: prefix.split("\n").length - 1 };
}

/** Invisible webview that executes JavaScript and streams console output back. */
export function CodeRunner({ html, lineOffset, onLine, onLoaded }: { html: string; lineOffset: number; onLine: (l: OutputLine) => void; onLoaded: () => void }) {
  const ref = useRef<WebviewEl>(null);
  const cb = useRef({ onLine, onLoaded });
  cb.current = { onLine, onLoaded };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onConsole = (e: Event & { level?: number | string; message?: string; line?: number; sourceId?: string }) => {
      const lvl = typeof e.level === "number" ? ["log", "info", "warn", "error"][e.level] ?? "log" : e.level === "warning" ? "warn" : e.level === "error" ? "error" : e.level === "info" ? "info" : "log";
      let text = String(e.message ?? "");
      if (lvl === "error" && e.line && e.line > lineOffset && /^Uncaught/.test(text)) text += `  (line ${e.line - lineOffset})`;
      cb.current.onLine({ kind: lvl as OutputLine["kind"], text });
    };
    const onFinish = () => cb.current.onLoaded();
    el.addEventListener("console-message", onConsole as EventListener);
    el.addEventListener("did-finish-load", onFinish);
    return () => {
      el.removeEventListener("console-message", onConsole as EventListener);
      el.removeEventListener("did-finish-load", onFinish);
    };
  }, [lineOffset]);

  if (!hasWebview()) return null;
  return (
    <webview
      ref={ref as React.Ref<HTMLElement>}
      src={htmlToUrl(html)}
      partition="deltaos-runner"
      style={{ position: "absolute", width: 1, height: 1, left: -10, top: -10, opacity: 0, pointerEvents: "none" }}
    />
  );
}

/**
 * Live, sandboxed preview of an HTML document. Each update loads into a fresh webview that is
 * swapped in once it has painted, instead of navigating one webview over and over. That avoids
 * flicker and the Windows "webview stops painting after navigation" problem.
 */
export function HtmlPreview({ html }: { html: string }) {
  const [frames, setFrames] = useState<{ id: number; html: string }[]>(() => [{ id: 1, html }]);
  const [shown, setShown] = useState(0);
  const seq = useRef(1);

  useEffect(() => {
    setFrames((fs) => (fs[fs.length - 1]?.html === html ? fs : [...fs.filter((f) => f.id === shown), { id: ++seq.current, html }]));
  }, [html, shown]);

  if (!hasWebview()) {
    return <div className="absolute inset-0 grid place-items-center text-[12.5px] text-muted">HTML preview runs in the DeltaOS desktop app.</div>;
  }
  return (
    <>
      {frames.map((f) => (
        <PreviewFrame
          key={f.id}
          html={f.html}
          visible={f.id === shown || (shown === 0 && f === frames[frames.length - 1])}
          onReady={() => {
            setShown(f.id);
            setFrames((fs) => fs.filter((x) => x.id >= f.id));
          }}
        />
      ))}
    </>
  );
}

function PreviewFrame({ html, visible, onReady }: { html: string; visible: boolean; onReady: () => void }) {
  const ref = useRef<WebviewEl>(null);
  const [src] = useState(() => htmlToUrl(html));
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => {
      ready.current();
      repaint(el);
    };
    const crashed = (e: Event & { reason?: string }) => window.deltaos?.log(`html preview crashed: ${e.reason ?? "unknown"}`);
    el.addEventListener("did-finish-load", done);
    el.addEventListener("render-process-gone", crashed as EventListener);
    return () => {
      el.removeEventListener("did-finish-load", done);
      el.removeEventListener("render-process-gone", crashed as EventListener);
    };
  }, []);
  useEffect(() => {
    if (visible) repaint(ref.current);
  }, [visible]);
  return (
    <webview
      ref={ref as React.Ref<HTMLElement>}
      src={src}
      partition="deltaos-runner"
      className="absolute inset-0 bg-white"
      style={{ visibility: visible ? "visible" : "hidden" }}
    />
  );
}
