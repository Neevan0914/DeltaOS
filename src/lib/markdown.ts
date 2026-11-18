// Tiny, safe markdown → HTML renderer for chat bubbles. Escapes all HTML first.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

export function renderMarkdown(src: string): string {
  const out: string[] = [];
  const blocks = src.split(/```/);
  blocks.forEach((block, i) => {
    if (i % 2 === 1) {
      const code = block.replace(/^[\w+-]*\n/, "");
      out.push(`<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`);
      return;
    }
    const lines = esc(block).split("\n");
    let list: "ul" | "ol" | null = null;
    let para: string[] = [];
    const flushPara = () => {
      if (para.length) out.push(`<p>${inline(para.join("<br/>"))}</p>`);
      para = [];
    };
    const closeList = () => {
      if (list) out.push(`</${list}>`);
      list = null;
    };
    for (const line of lines) {
      const ul = line.match(/^\s*[-*•]\s+(.*)/);
      const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
      const h = line.match(/^(#{1,3})\s+(.*)/);
      if (ul || ol) {
        flushPara();
        const kind = ul ? "ul" : "ol";
        if (list !== kind) {
          closeList();
          out.push(`<${kind}>`);
          list = kind;
        }
        out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      } else if (h) {
        flushPara();
        closeList();
        out.push(`<h3>${inline(h[2])}</h3>`);
      } else if (!line.trim()) {
        flushPara();
        closeList();
      } else {
        closeList();
        para.push(line);
      }
    }
    flushPara();
    closeList();
  });
  return out.join("");
}
