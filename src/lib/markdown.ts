// Small, safe Markdown → HTML renderer (chat bubbles, Code preview, Folio reading view).
// All input is HTML-escaped first; only http(s) links are emitted.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" data-external>$1</a>');
}

export function renderMarkdown(src: string): string {
  const out: string[] = [];
  src.split(/```/).forEach((block, i) => {
    if (i % 2 === 1) {
      const code = block.replace(/^[\w+#-]*\n/, "");
      out.push(`<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`);
      return;
    }
    const lines = esc(block).split("\n");
    let list: "ul" | "ol" | null = null;
    let para: string[] = [];
    let quote: string[] = [];
    const flushPara = () => {
      if (para.length) out.push(`<p>${inline(para.join("<br/>"))}</p>`);
      para = [];
    };
    const flushQuote = () => {
      if (quote.length) out.push(`<blockquote>${inline(quote.join("<br/>"))}</blockquote>`);
      quote = [];
    };
    const closeList = () => {
      if (list) out.push(`</${list}>`);
      list = null;
    };
    for (const line of lines) {
      const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)/);
      const ul = line.match(/^\s*[-*•]\s+(.*)/);
      const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
      const h = line.match(/^(#{1,6})\s+(.*)/);
      const q = line.match(/^&gt;\s?(.*)/);
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
        flushPara(); flushQuote(); closeList();
        out.push("<hr/>");
      } else if (q) {
        flushPara(); closeList();
        quote.push(q[1]);
      } else if (task || ul || ol) {
        flushPara(); flushQuote();
        const kind = ol && !ul ? "ol" : "ul";
        if (list !== kind) {
          closeList();
          out.push(`<${kind}${task ? ' class="tasks"' : ""}>`);
          list = kind;
        }
        if (task) {
          const done = task[1].toLowerCase() === "x";
          out.push(`<li class="task${done ? " done" : ""}"><span class="box">${done ? "✓" : ""}</span>${inline(task[2])}</li>`);
        } else out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      } else if (h) {
        flushPara(); flushQuote(); closeList();
        const level = Math.min(3, h[1].length);
        out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      } else if (!line.trim()) {
        flushPara(); flushQuote(); closeList();
      } else {
        flushQuote(); closeList();
        para.push(line);
      }
    }
    flushPara();
    flushQuote();
    closeList();
  });
  return out.join("");
}
