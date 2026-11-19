// Lightweight regex-based syntax highlighter producing escaped HTML.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const JS_KW = words(`async await break case catch class const continue debugger default delete do else export extends false finally for
  from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield`);
const KW: Record<string, string[]> = {
  js: JS_KW,
  ts: [...JS_KW, ...words("abstract as declare enum implements interface keyof namespace private protected public readonly type unknown never any string number boolean satisfies")],
  py: words("and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield match case self print"),
  cpp: words(`alignas auto bool break case catch char class const constexpr continue default delete do double else enum explicit extern false float for
    friend if inline int long namespace new noexcept nullptr operator private protected public return short signed sizeof static struct switch template
    this throw true try typedef typename union unsigned using virtual void volatile while size_t`),
  cs: words(`abstract as async await base bool break byte case catch char class const continue decimal default delegate do double else enum event explicit
    false finally fixed float for foreach get if implicit in init int interface internal is lock long namespace new null object out override params
    private protected public readonly record ref return sbyte sealed set short sizeof static string struct switch this throw true try typeof uint ulong
    using var virtual void while yield`),
  css: [],
  sh: words("if then else fi for in do done while case esac function return export local echo"),
  json: ["true", "false", "null"],
};

/** The six languages the Code editor offers in its language picker. */
export const CODE_LANGUAGES = [
  { id: "py", label: "Python", ext: "py" },
  { id: "cpp", label: "C++", ext: "cpp" },
  { id: "html", label: "HTML", ext: "html" },
  { id: "js", label: "JavaScript", ext: "js" },
  { id: "ts", label: "TypeScript", ext: "ts" },
  { id: "cs", label: "C#", ext: "cs" },
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]["id"];

export const LANGUAGE_LABEL: Record<string, string> = {
  py: "Python", cpp: "C++", html: "HTML", js: "JavaScript", ts: "TypeScript", cs: "C#",
  css: "CSS", json: "JSON", md: "Markdown", sh: "Shell", txt: "Plain Text",
};

export function languageOf(name: string): string {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  if (lower.startsWith(".") && !lower.slice(1).includes(".")) return "sh";
  const map: Record<string, string> = {
    py: "py", pyw: "py",
    cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp", h: "cpp", c: "cpp",
    cs: "cs",
    html: "html", htm: "html", xml: "html", svg: "html",
    js: "js", jsx: "js", mjs: "js", cjs: "js",
    ts: "ts", tsx: "ts", mts: "ts", cts: "ts",
    java: "cs", go: "js", rs: "cpp",
    css: "css", scss: "css",
    json: "json",
    md: "md", markdown: "md",
    sh: "sh", bash: "sh", zsh: "sh",
  };
  return map[ext] ?? "txt";
}

export const TEMPLATES: Record<CodeLanguage, string> = {
  py: `def greet(name: str) -> str:
    return f"Hello, {name}!"


def main() -> None:
    for name in ["DeltaOS", "Folio", "Tesseract"]:
        print(greet(name))


if __name__ == "__main__":
    main()
`,
  cpp: `#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<std::string> names = {"DeltaOS", "Folio", "Tesseract"};
    for (const auto& name : names) {
        std::cout << "Hello, " << name << "!" << std::endl;
    }
    return 0;
}
`,
  html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Hello DeltaOS</title>
    <style>
      body { font-family: system-ui, sans-serif; display: grid; place-items: center; height: 100vh; margin: 0;
             background: linear-gradient(135deg, #7c5cff, #22d3ee); color: white; }
      button { font-size: 16px; padding: 10px 18px; border-radius: 999px; border: 0; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>Hello, DeltaOS!</h1>
      <button id="btn">Clicked 0 times</button>
    </main>
    <script>
      let count = 0;
      document.getElementById("btn").addEventListener("click", (e) => {
        e.target.textContent = \`Clicked \${++count} times\`;
      });
    </script>
  </body>
</html>
`,
  js: `// Press Run (Ctrl+Enter) to execute — output appears below.
const names = ["DeltaOS", "Folio", "Tesseract"];

function greet(name) {
  return \`Hello, \${name}!\`;
}

for (const name of names) {
  console.log(greet(name));
}

console.log({ total: names.length, longest: names.reduce((a, b) => (b.length > a.length ? b : a)) });
`,
  ts: `// Press Run (Ctrl+Enter) to execute — types are stripped before running.
interface App {
  name: string;
  kind: "browser" | "editor" | "writer";
}

const apps: App[] = [
  { name: "Tesseract", kind: "browser" },
  { name: "Code", kind: "editor" },
  { name: "Folio", kind: "writer" },
];

function describe({ name, kind }: App): string {
  return \`\${name} is a \${kind}\`;
}

apps.map(describe).forEach((line) => console.log(line));
`,
  cs: `using System;
using System.Collections.Generic;

namespace DeltaOS
{
    public static class Program
    {
        public static void Main(string[] args)
        {
            var names = new List<string> { "DeltaOS", "Folio", "Tesseract" };
            foreach (var name in names)
            {
                Console.WriteLine($"Hello, {name}!");
            }
        }
    }
}
`,
};

const C_LIKE = new Set(["js", "ts", "cpp", "cs", "css"]);

export function highlight(code: string, lang: string): string {
  if (lang === "txt") return esc(code);
  if (lang === "md") return highlightMd(code);
  if (lang === "html") return highlightHtml(code);
  const kws = new Set(KW[lang] ?? []);
  const hashComments = lang === "py" || lang === "sh";
  const re = new RegExp(
    [
      lang === "cpp" || lang === "cs" ? String.raw`#[ \t]*[A-Za-z]+(?:[ \t]*<[^>\n]+>)?` : null,
      C_LIKE.has(lang) ? String.raw`\/\*[\s\S]*?\*\/` : null,
      hashComments ? "#[^\\n]*" : lang !== "css" && lang !== "json" ? String.raw`\/\/[^\n]*` : null,
      lang === "py" ? String.raw`"""[\s\S]*?"""|'''[\s\S]*?'''` : null,
      String.raw`[$@]?"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'`,
      lang === "js" || lang === "ts" ? "`(?:\\\\.|[^`\\\\])*`" : null,
      lang === "css" ? String.raw`#[0-9a-fA-F]{3,8}\b` : null,
      String.raw`\b\d+(?:\.\d+)?(?:px|em|rem|%|s|ms|vh|vw|f|u|L)?\b`,
      String.raw`[A-Za-z_$][\w$-]*`,
      String.raw`[{}()[\];,.:=+\-*/<>!&|?%^~@]+`,
    ]
      .filter(Boolean)
      .join("|"),
    "g",
  );
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) parts.push(esc(code.slice(last, m.index)));
    const t = m[0];
    const next = code.slice(re.lastIndex).match(/^\s*(.)/)?.[1];
    let cls = "";
    if (t.startsWith("#") && (lang === "cpp" || lang === "cs")) cls = "tok-kw";
    else if (t.startsWith("/*") || t.startsWith("//") || (t.startsWith("#") && hashComments)) cls = "tok-com";
    else if (/^[$@]?["'`]/.test(t)) cls = lang === "json" && next === ":" ? "tok-fn" : "tok-str";
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

function highlightHtml(code: string) {
  // Highlight markup, plus embedded <script> and <style> blocks with their own grammars.
  const out: string[] = [];
  const re = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)|(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    out.push(markup(code.slice(last, m.index)));
    if (m[1]) out.push(markup(m[1]), highlight(m[2], "js"), markup(m[3]));
    else out.push(markup(m[4]), highlight(m[5], "css"), markup(m[6]));
    last = re.lastIndex;
  }
  out.push(markup(code.slice(last)));
  return out.join("");
}

function markup(s: string) {
  // Single pass so later rules never re-match the spans earlier rules inserted.
  return esc(s).replace(
    /(&lt;!--[\s\S]*?--&gt;)|(&lt;!?\/?)([\w-]+)|([\w-]+)=("[^"\n]*")/g,
    (_m, com, open, tag, attr, val) =>
      com
        ? `<span class="tok-com">${com}</span>`
        : tag
          ? `${open}<span class="tok-tag">${tag}</span>`
          : `<span class="tok-fn">${attr}</span>=<span class="tok-str">${val}</span>`,
  );
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
