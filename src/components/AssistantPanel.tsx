import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, KeyRound, RotateCcw, Square, Wrench, X, AlertTriangle } from "lucide-react";
import { clearChat, refreshStatus, sendMessage, stopGenerating, toggleAssistant, useAssistant, type ChatMsg } from "../os/assistant";
import { useOS } from "../os/store";
import { openApp, TASKBAR_H } from "../os/windows";
import { renderMarkdown } from "../lib/markdown";
import { ClaudeMark } from "./Logo";
import { Avatar } from "./Avatar";

const SUGGESTIONS = [
  "Switch to light mode with the Rose Quartz wallpaper",
  "Make my desktop feel like a calm ocean",
  "Create a packing list in ~/Documents for a weekend trip",
  "What's in my Code folder?",
];

export function AssistantPanel() {
  const open = useOS((s) => s.assistantOpen);
  const username = useOS((s) => s.settings.username);
  const { messages, busy, status } = useAssistant();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      void refreshStatus();
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (text = input) => {
    if (!text.trim() || busy) return;
    setInput("");
    void sendMessage(text);
  };

  const online = !!status?.configured;
  if (!open) return null;

  return (
    <div
      className="absolute right-3 top-3 w-[420px] rounded-2xl glass-menu z-[9400] flex flex-col overflow-hidden anim-slide-right text-fg"
      style={{ bottom: TASKBAR_H + 12 }}
      data-assistant-panel
    >
      <div className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-line">
        <div
          className="w-8 h-8 rounded-[10px] grid place-items-center text-white"
          style={{ background: "linear-gradient(135deg, #f0a27a 0%, #d97757 55%, #b9583c 100%)" }}
        >
          <ClaudeMark size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold leading-tight">Claude</div>
          <div className="text-[11.5px] text-muted flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-amber-400"}`} />
            {online ? `Connected · ${status?.model}` : "Offline mode · system commands only"}
          </div>
        </div>
        <button title="New chat" disabled={busy} onClick={clearChat} className="w-8 h-8 rounded-lg grid place-items-center text-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30">
          <RotateCcw size={15} />
        </button>
        <button title="Close (Ctrl+Space)" onClick={() => toggleAssistant(false)} className="w-8 h-8 rounded-lg grid place-items-center text-muted hover:text-fg hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="pt-6 anim-fade-in">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl grid place-items-center text-white anim-glow" style={{ background: "linear-gradient(135deg, #f0a27a, #d97757)" }}>
                <ClaudeMark size={28} />
              </div>
              <div className="mt-4 text-[18px] font-semibold">Hi {username.split(" ")[0]}, how can I help?</div>
              <div className="mt-1 text-[12.5px] text-muted max-w-[300px]">Ask me anything, or tell me to change your theme, wallpaper, open apps and manage files.</div>
            </div>
            {!online && (
              <button
                onClick={() => openApp("settings", { section: "claude" })}
                className="mt-5 w-full flex items-center gap-3 p-3 rounded-xl border border-amber-400/30 bg-amber-400/10 text-left hover:bg-amber-400/15 transition-colors"
              >
                <KeyRound size={17} className="text-amber-400 shrink-0" />
                <div className="text-[12px] leading-snug">
                  <div className="font-semibold">Add your Anthropic API key</div>
                  <div className="text-muted">Unlocks full conversations. Until then I understand system commands.</div>
                </div>
              </button>
            )}
            <div className="mt-5 grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="text-left text-[12.5px] px-3.5 py-2.5 rounded-xl bg-surface border border-line hover:bg-surface-2 hover:border-accent/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} username={username} />
        ))}
      </div>

      <div className="p-3 border-t border-line">
        <div className="flex items-end gap-2 rounded-2xl bg-input border border-line p-1.5 pl-3.5 focus-within:border-accent transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(140, e.target.scrollHeight) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
                (e.target as HTMLTextAreaElement).style.height = "auto";
              }
            }}
            placeholder="Message Claude…"
            className="flex-1 resize-none bg-transparent outline-none text-[13.5px] leading-5 py-1.5 max-h-[140px] placeholder:text-faint"
          />
          {busy ? (
            <button onClick={stopGenerating} title="Stop" className="w-8 h-8 rounded-xl grid place-items-center bg-surface-2 text-fg hover:brightness-125">
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={() => submit()}
              disabled={!input.trim()}
              title="Send"
              className="w-8 h-8 rounded-xl grid place-items-center bg-accent text-accent-fg disabled:opacity-30 transition-all active:scale-90"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <div className="text-[10.5px] text-faint text-center mt-2">Claude can make mistakes. Changes it makes are applied instantly.</div>
      </div>
    </div>
  );
}

function Message({ m, username }: { m: ChatMsg; username: string }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end gap-2 anim-pop-in">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent text-accent-fg px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words">{m.text}</div>
        <Avatar name={username} size={26} />
      </div>
    );
  }
  if (m.role === "error") {
    return (
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[12.5px] anim-pop-in">
        <AlertTriangle size={16} className="text-rose-400 mt-px shrink-0" />
        <div>{m.text}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 anim-pop-in">
      <div className="w-[26px] h-[26px] rounded-lg grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #f0a27a, #d97757)" }}>
        <ClaudeMark size={13} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {m.tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {m.tools.map((t, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg border ${
                  t.ok ? "bg-surface border-line text-muted" : "bg-rose-500/10 border-rose-500/25 text-rose-400"
                }`}
              >
                {t.ok ? <Check size={11} className="text-emerald-400" /> : <Wrench size={11} />}
                {t.label}
              </span>
            ))}
          </div>
        )}
        {m.text ? (
          <div className="chat-md text-[13px] leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
        ) : m.streaming ? (
          <div className="flex gap-1 py-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted" style={{ animation: `dot-bounce 1.2s ${i * 0.15}s infinite` }} />
            ))}
          </div>
        ) : null}
        {m.offline && <div className="mt-1.5 text-[10.5px] text-faint">Offline assistant</div>}
      </div>
    </div>
  );
}
