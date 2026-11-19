import { useEffect, useRef } from "react";
import { transform } from "sucrase";
import { hasWebview, type WebviewEl } from "../lib/webview";

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
      src={"data:text/html;charset=utf-8," + encodeURIComponent(html)}
      partition="deltaos-runner"
      style={{ position: "absolute", width: 1, height: 1, left: -10, top: -10, opacity: 0, pointerEvents: "none" }}
    />
  );
}

/** Live, sandboxed preview of an HTML document. */
export function HtmlPreview({ html }: { html: string }) {
  if (!hasWebview()) {
    return <div className="absolute inset-0 grid place-items-center text-[12.5px] text-muted">HTML preview runs in the DeltaOS desktop app.</div>;
  }
  return (
    <webview
      src={"data:text/html;charset=utf-8," + encodeURIComponent(html)}
      partition="deltaos-runner"
      className="absolute inset-0 bg-white"
    />
  );
}
