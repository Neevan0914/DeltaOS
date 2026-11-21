import { useEffect, useState } from "react";
import { FolderOpen, Palette, Image as ImageIcon, User, Monitor, Info, Moon, Sun, Check, KeyRound, ShieldCheck, Trash2, ExternalLink, SquareTerminal } from "lucide-react";
import type { AppProps } from "../components/AppHost";
import { updateSettings, useOS, notify, setState } from "../os/store";
import { ACCENTS } from "../os/theme";
import { WALLPAPERS } from "../os/wallpapers";
import { refreshStatus, useAssistant } from "../os/assistant";
import { Button, Segmented, Toggle } from "../components/ui";
import { Avatar } from "../components/Avatar";
import { ClaudeMark, DeltaLogo } from "../components/Logo";
import { createDefaultFs } from "../os/vfs";

type Section = "appearance" | "wallpaper" | "system" | "account" | "claude" | "about";

const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ size?: number }>; color: string }[] = [
  { id: "appearance", label: "Appearance", icon: Palette, color: "#a855f7" },
  { id: "wallpaper", label: "Wallpaper", icon: ImageIcon, color: "#06b6d4" },
  { id: "system", label: "System", icon: Monitor, color: "#3b82f6" },
  { id: "account", label: "Account", icon: User, color: "#10b981" },
  { id: "claude", label: "Claude AI", icon: ClaudeMark as React.ComponentType<{ size?: number }>, color: "#d97757" },
  { id: "about", label: "About", icon: Info, color: "#64748b" },
];

export function SettingsApp({ win }: AppProps) {
  const [section, setSection] = useState<Section>((win.props.section as Section) ?? "appearance");
  useEffect(() => {
    if (win.props.section) setSection(win.props.section as Section);
  }, [win.props.section]);
  const username = useOS((s) => s.settings.username);

  return (
    <div className="absolute inset-0 flex text-fg">
      <div className="w-56 shrink-0 border-r border-line bg-surface p-3 flex flex-col">
        <div className="flex items-center gap-3 p-2 mb-3">
          <Avatar name={username} size={38} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate">{username}</div>
            <div className="text-[11.5px] text-muted">Local account</div>
          </div>
        </div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-3 h-9 px-2.5 rounded-lg text-[13px] transition-colors ${
              section === s.id ? "bg-accent/15 font-medium" : "text-muted hover:text-fg hover:bg-surface-2"
            }`}
          >
            <span className="w-6 h-6 rounded-md grid place-items-center text-white" style={{ background: s.color }}>
              <s.icon size={14} />
            </span>
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-[640px] mx-auto p-8" key={section}>
          <div className="anim-fade-in">
            {section === "appearance" && <Appearance />}
            {section === "wallpaper" && <WallpaperSection />}
            {section === "system" && <SystemSection />}
            {section === "account" && <Account />}
            {section === "claude" && <ClaudeSection />}
            {section === "about" && <About />}
          </div>
        </div>
      </div>
    </div>
  );
}

function H({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
      {sub && <p className="text-[13px] text-muted mt-1">{sub}</p>}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface border border-line divide-y divide-[var(--os-border)] mb-5 ${className}`}>{children}</div>;
}

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium">{title}</div>
        {sub && <div className="text-[12px] text-muted mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Appearance() {
  const s = useOS((st) => st.settings);
  return (
    <>
      <H title="Appearance" sub="Make DeltaOS look the way you like." />
      <div className="grid grid-cols-2 gap-4 mb-5">
        {(["dark", "light"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => updateSettings({ theme: mode })}
            className={`rounded-2xl p-2 border-2 transition-all text-left ${s.theme === mode ? "border-accent" : "border-line hover:border-[color-mix(in_oklab,var(--os-text)_25%,transparent)]"}`}
          >
            <ThemePreview mode={mode} />
            <div className="flex items-center gap-2 px-2 pt-3 pb-1 text-[13px] font-medium">
              {mode === "dark" ? <Moon size={15} /> : <Sun size={15} />}
              {mode === "dark" ? "Dark" : "Light"}
              {s.theme === mode && <Check size={15} className="ml-auto text-accent" />}
            </div>
          </button>
        ))}
      </div>
      <Card>
        <div className="px-5 py-4">
          <div className="text-[13.5px] font-medium">Accent color</div>
          <div className="text-[12px] text-muted mt-0.5 mb-4">Used for highlights, selections and buttons.</div>
          <div className="flex flex-wrap items-center gap-3">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                title={a.name}
                onClick={() => updateSettings({ accent: a.hex })}
                className="w-9 h-9 rounded-full grid place-items-center transition-transform hover:scale-110"
                style={{ background: a.hex, boxShadow: s.accent === a.hex ? `0 0 0 3px var(--os-window), 0 0 0 5px ${a.hex}` : undefined }}
              >
                {s.accent === a.hex && <Check size={16} color="white" strokeWidth={3} />}
              </button>
            ))}
            <label className="relative w-9 h-9 rounded-full grid place-items-center border-2 border-dashed border-line hover:border-accent cursor-pointer" title="Custom color"
              style={!ACCENTS.some((a) => a.hex === s.accent) ? { background: s.accent, borderStyle: "solid" } : undefined}>
              <span className="text-[16px] text-muted">+</span>
              <input type="color" value={s.accent} onChange={(e) => updateSettings({ accent: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
        </div>
      </Card>
      <Card>
        <Row title="Transparency effects" sub="Frosted-glass blur on windows, menus and the taskbar">
          <Toggle checked={s.transparency} onChange={(v) => updateSettings({ transparency: v })} label="Transparency" />
        </Row>
        <Row title="Animations" sub="Window open/close, minimize and menu transitions">
          <Toggle checked={s.animations} onChange={(v) => updateSettings({ animations: v })} label="Animations" />
        </Row>
        <Row title="Terminal theme" sub="Color scheme used by the Terminal app">
          <Segmented
            value={s.terminalTheme}
            onChange={(v) => updateSettings({ terminalTheme: v })}
            options={[
              { value: "delta", label: "Delta" },
              { value: "matrix", label: "Matrix" },
              { value: "amber", label: "Amber" },
              { value: "ice", label: "Ice" },
            ]}
          />
        </Row>
      </Card>
    </>
  );
}

function ThemePreview({ mode }: { mode: "dark" | "light" }) {
  const dark = mode === "dark";
  return (
    <div className="relative h-28 rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #3b2bff, #00d2ff 60%, #9b2cff)" }}>
      <div className="absolute left-4 top-4 right-10 bottom-6 rounded-lg" style={{ background: dark ? "rgb(20 22 30 / 0.85)" : "rgb(250 250 253 / 0.85)" }}>
        <div className="flex gap-1 p-2">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />)}
        </div>
        <div className="mx-2 h-1.5 w-1/2 rounded-full" style={{ background: dark ? "#ffffff30" : "#00000020" }} />
        <div className="mx-2 mt-1.5 h-1.5 w-1/3 rounded-full bg-accent" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-4" style={{ background: dark ? "rgb(16 18 26 / 0.8)" : "rgb(248 248 252 / 0.8)" }} />
    </div>
  );
}

function WallpaperSection() {
  const current = useOS((s) => s.settings.wallpaper);
  return (
    <>
      <H title="Wallpaper" sub="Pick a background for your desktop and lock screen." />
      <div className="grid grid-cols-3 gap-4">
        {WALLPAPERS.map((w) => (
          <button key={w.id} onClick={() => updateSettings({ wallpaper: w.id })} className="text-left group">
            <div
              className={`relative aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all group-hover:scale-[1.02] ${current === w.id ? "border-accent" : "border-transparent"}`}
              style={{ background: w.css, backgroundSize: "160px 160px, cover, cover, cover, cover, cover" }}
            >
              {current === w.id && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent text-accent-fg grid place-items-center shadow">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="text-[12.5px] font-medium mt-2 px-0.5">{w.name}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function SystemSection() {
  const s = useOS((st) => st.settings);
  return (
    <>
      <H title="System" sub="Clock, display and storage." />
      <Card>
        <Row title="24-hour clock" sub="Show time as 14:30 instead of 2:30 PM">
          <Toggle checked={s.clock24} onChange={(v) => updateSettings({ clock24: v })} label="24-hour clock" />
        </Row>
        {window.deltaos && (
          <Row title="Full screen" sub="Toggle full screen mode (F11)">
            <Button onClick={() => window.deltaos?.toggleFullscreen()}>
              <Monitor size={14} /> Toggle
            </Button>
          </Row>
        )}
      </Card>
      <Card>
        <Row title="Keyboard shortcuts" sub="Ctrl+Space Claude · Ctrl+Alt+T Terminal · Ctrl+Alt+E Files · F11 Full screen">
          <SquareTerminal size={18} className="text-muted" />
        </Row>
      </Card>
      {window.deltaos && (
        <Card>
          <Row title="Diagnostics log" sub="If something doesn't work, this log records page loads, crashes and graphics info. Send it along with your report.">
            <Button onClick={() => void window.deltaos?.openLogs()}>
              <FolderOpen size={14} /> Open folder
            </Button>
          </Row>
        </Card>
      )}
      <Card>
        <Row title="Reset file system" sub="Restore the default files and folders. Your own files will be deleted.">
          <Button
            variant="danger"
            onClick={() => {
              if (!confirm("Reset all files to the defaults? This cannot be undone.")) return;
              setState({ fs: createDefaultFs() });
              notify("File system reset", "Default files restored.", "success");
            }}
          >
            <Trash2 size={14} /> Reset
          </Button>
        </Row>
      </Card>
    </>
  );
}

function Account() {
  const s = useOS((st) => st.settings);
  const [name, setName] = useState(s.username);
  const [pw, setPw] = useState("");
  return (
    <>
      <H title="Account" sub="Your profile and sign-in options." />
      <div className="flex items-center gap-5 mb-6">
        <Avatar name={s.username} size={80} />
        <div>
          <div className="text-[20px] font-semibold">{s.username}</div>
          <div className="text-[12.5px] text-muted">{s.password ? "Password protected" : "No password"}</div>
        </div>
      </div>
      <Card>
        <Row title="Display name" sub="Shown on the login screen and in the terminal prompt">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { updateSettings({ username: name.trim() }); notify("Profile updated", `Display name set to ${name.trim()}`, "success"); } }}>
            <input value={name} onChange={(e) => setName(e.target.value)} className="os-input w-44" maxLength={32} />
            <Button type="submit" variant="accent" disabled={!name.trim() || name.trim() === s.username}>Save</Button>
          </form>
        </Row>
        <Row title="Password" sub={s.password ? "Change or remove the password used on the lock screen" : "Protect the lock screen with a password"}>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); updateSettings({ password: pw }); setPw(""); notify("Password updated", pw ? "Your account is now password protected." : "Password removed.", "success"); }}>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={s.password ? "New password" : "Set a password"} className="os-input w-44" />
            <Button type="submit" variant="accent" disabled={!pw}>Set</Button>
            {s.password && <Button type="button" onClick={() => { updateSettings({ password: "" }); notify("Password removed", "", "success"); }}>Remove</Button>}
          </form>
        </Row>
      </Card>
    </>
  );
}

function ClaudeSection() {
  const { status } = useAssistant();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void refreshStatus();
  }, []);
  const bridge = window.deltaos;

  return (
    <>
      <H title="Claude AI" sub="The built-in assistant. Open it from the taskbar or with Ctrl+Space." />
      <div className="rounded-2xl p-5 mb-5 flex items-center gap-4 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #f0a27a 0%, #d97757 50%, #8c3f2b 100%)" }}>
        <div className="w-12 h-12 rounded-xl bg-white/20 grid place-items-center backdrop-blur"><ClaudeMark size={26} /></div>
        <div className="flex-1">
          <div className="text-[16px] font-semibold">{status?.configured ? "Claude is connected" : "Claude is in offline mode"}</div>
          <div className="text-[12.5px] text-white/80">
            {status?.configured
              ? `Using ${status.model}${status.source === "environment" ? " · key from ANTHROPIC_API_KEY" : ""}`
              : "System commands work offline. Add an API key for full conversations."}
          </div>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full ${status?.configured ? "bg-emerald-300" : "bg-amber-200"} shadow-[0_0_10px_currentColor]`} />
      </div>

      {bridge ? (
        <Card>
          <div className="px-5 py-4">
            <div className="text-[13.5px] font-medium flex items-center gap-2"><KeyRound size={15} /> Anthropic API key</div>
            <div className="text-[12px] text-muted mt-0.5 mb-3">
              Create one at console.anthropic.com. It is stored {status?.encrypted ? "encrypted with your OS keychain" : "locally"} and never leaves this computer except to call the Claude API.
            </div>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                await bridge.claude.setKey(key);
                await refreshStatus();
                setKey("");
                setBusy(false);
                notify("Claude connected", "Your API key was saved.", "success");
              }}
            >
              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={status?.source === "settings" ? "•••••••••••• (saved) — enter a new key to replace" : "sk-ant-…"} className="os-input flex-1 font-mono" />
              <Button type="submit" variant="accent" disabled={!key.trim() || busy}>Save key</Button>
            </form>
            {status?.source === "settings" && (
              <button
                onClick={async () => { await bridge.claude.clearKey(); await refreshStatus(); notify("API key removed", "", "info"); }}
                className="mt-3 text-[12px] text-rose-400 hover:underline flex items-center gap-1.5"
              >
                <Trash2 size={12} /> Remove saved key
              </button>
            )}
          </div>
          <Row title="Privacy" sub="Your messages and the files Claude reads are sent to Anthropic to generate replies.">
            <ShieldCheck size={18} className="text-emerald-400" />
          </Row>
          <Row title="Get an API key" sub="console.anthropic.com → API Keys">
            <Button onClick={() => window.open("https://console.anthropic.com/settings/keys")}><ExternalLink size={14} /> Open</Button>
          </Row>
        </Card>
      ) : (
        <Card><Row title="Desktop app required" sub="API keys can be configured when DeltaOS runs as the desktop app."><KeyRound size={18} className="text-muted" /></Row></Card>
      )}

      <Card>
        <div className="px-5 py-4">
          <div className="text-[13.5px] font-medium mb-2">What Claude can do</div>
          <ul className="text-[12.5px] text-muted space-y-1.5 list-disc pl-4">
            <li>Change the theme, accent color, wallpaper, transparency and animations</li>
            <li>Open and close apps, and open specific files or folders</li>
            <li>Read, write and organise files in your home folder</li>
            <li>Answer questions, explain code and draft text (online mode)</li>
          </ul>
        </div>
      </Card>
    </>
  );
}

function About() {
  const v = window.deltaos?.versions;
  return (
    <>
      <H title="About" />
      <div className="flex flex-col items-center text-center py-6">
        <DeltaLogo size={84} className="anim-glow" />
        <div className="text-[26px] font-semibold mt-4">DeltaOS</div>
        <div className="text-[13px] text-muted">Version 1.3 “Aurora”</div>
      </div>
      <Card>
        <Row title="Runtime" sub={v ? `Electron ${v.electron} · Chromium ${v.chrome} · Node ${v.node}` : "Web preview"}><span /></Row>
        <Row title="Assistant" sub="Claude by Anthropic"><span /></Row>
        <Row title="Display" sub={`${window.screen.width} × ${window.screen.height} @ ${window.devicePixelRatio}x`}><span /></Row>
      </Card>
    </>
  );
}
