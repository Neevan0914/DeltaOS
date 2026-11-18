// Lightweight regex-based syntax highlighter producing escaped HTML.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const KW: Record<string, string[]> = {
  ts: "abstract as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function get if implements import in instanceof interface let new null of private protected public readonly return set static super switch this throw true try type typeof undefined var void while with yield".split(" "),
  py: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield print self".split(" "),
  css: [],
  sh: "if then else fi for in do done while case esac function return export local echo".split(" "),
  json: ["true", "false", "null"],
};

export function languageOf(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs", "java", "c", "cpp", "go", "rs"].includes(ext)) return "ts";
  if (ext === "py") return "py";
  if (ext === "css" || ext === "scss") return "css";
  if (ext === "json") return "json";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "sh" || ext === "bash" || name.startsWith(".")) return "sh";
  if (ext === "html" || ext === "xml" || ext === "svg") return "html";
  return "txt";
}

export const LANGUAGE_LABEL: Record<string, string> = {
  ts: "TypeScript / JavaScript", py: "Python", css: "CSS", json: "JSON", md: "Markdown", sh: "Shell", html: "HTML", txt: "Plain Text",
};

export function highlight(code: string, lang: string): string {
  if (lang === "txt") return esc(code);
  if (lang === "md") return highlightMd(code);
  if (lang === "html") {
    return esc(code)
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-com">$1</span>')
      .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tok-tag">$2</span>')
      .replace(/([\w-]+)=(&quot;|")(.*?)\2/g, '<span class="tok-fn">$1</span>=<span class="tok-str">"$3"</span>');
  }
  const kws = new Set(KW[lang] ?? []);
  const lineCom = lang === "py" || lang === "sh" ? "#" : "//";
  const parts: string[] = [];
  const re = new RegExp(
    [
      lang === "css" || lang === "ts" ? String.raw`\/\*[\s\S]*?\*\/` : null,
      lang !== "css" && lang !== "json" ? `${lineCom === "#" ? "#" : String.raw`\/\/`}[^\n]*` : null,
      lang === "py" ? String.raw`"""[\s\S]*?"""|'''[\s\S]*?'''` : null,
      String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + "`(?:\\\\.|[^`\\\\])*`",
      String.raw`#[0-9a-fA-F]{3,8}\b`,
      String.raw`\b\d+(?:\.\d+)?(?:px|em|rem|%|s|ms|vh|vw)?\b`,
      String.raw`[A-Za-z_$][\w$-]*`,
      String.raw`[{}()[\];,.:=+\-*/<>!&|?%^~@]+`,
    ]
      .filter(Boolean)
      .join("|"),
    "g",
  );
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) parts.push(esc(code.slice(last, m.index)));
    const t = m[0];
    const next = code.slice(re.lastIndex).match(/^\s*(.)/)?.[1];
    let cls = "";
    if (t.startsWith("/*") || t.startsWith("//") || (t.startsWith("#") && lineCom === "#" && !/^#[0-9a-f]{3,8}$/i.test(t))) cls = "tok-com";
    else if (/^["'`]/.test(t)) cls = lang === "json" && next === ":" ? "tok-fn" : "tok-str";
    else if (/^#[0-9a-f]{3,8}$/i.test(t) || /^\d/.test(t)) cls = "tok-num";
    else if (/^[A-Za-z_$]/.test(t)) {
      if (kws.has(t)) cls = "tok-kw";
      else if (lang === "css" && next === ":") cls = "tok-fn";
      else if (next === "(") cls = "tok-fn";
      else if (/^[A-Z]/.test(t) && lang !== "css") cls = "tok-type";
    } else cls = "tok-op";
    parts.push(cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t));
    last = re.lastIndex;
  }
  if (last < code.length) parts.push(esc(code.slice(last)));
  return parts.join("");
}

function highlightMd(code: string) {
  return code
    .split("\n")
    .map((line) => {
      const e = esc(line);
      if (/^#{1,6}\s/.test(line)) return `<span class="tok-head">${e}</span>`;
      if (/^\s*>/.test(line)) return `<span class="tok-com">${e}</span>`;
      return e
        .replace(/^(\s*)([-*+]|\d+\.)(\s)/, '$1<span class="tok-kw">$2</span>$3')
        .replace(/(`[^`]+`)/g, '<span class="tok-str">$1</span>')
        .replace(/(\*\*[^*]+\*\*)/g, '<span class="tok-type">$1</span>')
        .replace(/(\[[ x]\])/g, '<span class="tok-num">$1</span>');
    })
    .join("\n");
}
