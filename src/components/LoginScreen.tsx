import { useEffect, useRef, useState } from "react";
import { ArrowRight, Power, RotateCcw, Lock } from "lucide-react";
import { Wallpaper } from "./Wallpaper";
import { useOS } from "../os/store";
import { formatTime, useClock } from "../lib/useClock";
import { Avatar } from "./Avatar";

export function LoginScreen({ onLogin, onPower }: { onLogin: () => void; onPower: (a: "shutdown" | "restart") => void }) {
  const settings = useOS((s) => s.settings);
  const now = useClock();
  const [revealed, setRevealed] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (revealed) return;
    const reveal = () => setRevealed(true);
    window.addEventListener("keydown", reveal);
    return () => window.removeEventListener("keydown", reveal);
  }, [revealed]);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    // Without a password field, Enter anywhere signs in.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !settings.password && !leaving) submitRef.current();
    };
    const arm = setTimeout(() => window.addEventListener("keydown", onKey), 50);
    return () => {
      clearTimeout(t);
      clearTimeout(arm);
      window.removeEventListener("keydown", onKey);
    };
  }, [revealed, settings.password, leaving]);

  const submitRef = useRef<() => void>(() => {});
  const submit = () => {
    if (settings.password && pw !== settings.password) {
      setError(true);
      setPw("");
      setTimeout(() => setError(false), 600);
      return;
    }
    setLeaving(true);
    setTimeout(onLogin, 520);
  };
  submitRef.current = submit;

  return (
    <div
      className="absolute inset-0 overflow-hidden text-white transition-all duration-500"
      style={{ opacity: leaving ? 0 : 1, transform: leaving ? "scale(1.04)" : "none" }}
      onClick={() => setRevealed(true)}
    >
      <Wallpaper blur={revealed ? 36 : 0} dim={revealed ? 0.35 : 0.12} />

      {/* Lock screen clock */}
      <div
        className="absolute inset-x-0 top-[13vh] flex flex-col items-center transition-all duration-500"
        style={{ opacity: revealed ? 0 : 1, transform: revealed ? "translateY(-40px)" : "none" }}
      >
        <div className="text-[17px] font-medium text-white/80 drop-shadow">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div className="text-[112px] leading-none font-semibold tracking-tighter drop-shadow-xl mt-2" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatTime(now, settings.clock24).replace(/\s?[AP]M/i, "")}
        </div>
        <div className="mt-[44vh] text-[13px] text-white/60 flex items-center gap-2">
          <Lock size={13} /> Click or press any key to unlock
        </div>
      </div>

      {/* Sign in */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-500"
        style={{ opacity: revealed ? 1 : 0, pointerEvents: revealed ? "auto" : "none", transform: revealed ? "none" : "translateY(30px)" }}
      >
        <Avatar name={settings.username} size={112} />
        <div className="mt-5 text-[26px] font-semibold drop-shadow">{settings.username}</div>
        <form
          className={`mt-6 flex items-center gap-2 ${error ? "anim-shake" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {settings.password ? (
            <div className="flex items-center rounded-full bg-white/15 border border-white/20 backdrop-blur-xl pl-5 pr-1.5 py-1.5 w-72 focus-within:border-white/50 transition-colors">
              <input
                ref={inputRef}
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Password"
                className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-white/50"
              />
              <button type="submit" className="w-8 h-8 rounded-full grid place-items-center bg-white/20 hover:bg-white/30 transition-colors">
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={submit}
              className="flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-xl px-7 py-2.5 text-[14px] font-medium transition-colors"
            >
              Sign in <ArrowRight size={16} />
            </button>
          )}
        </form>
        <div className="mt-4 h-5 text-[12px] text-white/55">
          {error ? "Incorrect password — try again" : settings.password ? "Enter your password" : "No password set · press Enter"}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <PowerBtn label="Restart" onClick={() => onPower("restart")}>
          <RotateCcw size={17} />
        </PowerBtn>
        <PowerBtn label="Shut down" onClick={() => onPower("shutdown")}>
          <Power size={17} />
        </PowerBtn>
      </div>
      <div className="absolute bottom-6 left-6 text-[12px] text-white/50 font-medium">DeltaOS 1.0</div>
    </div>
  );
}

function PowerBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      title={label}
      onClick={onClick}
      className="w-11 h-11 rounded-full grid place-items-center bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-xl transition-colors"
    >
      {children}
    </button>
  );
}
