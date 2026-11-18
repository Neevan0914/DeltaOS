import { useEffect, useState } from "react";
import { DeltaLogo } from "./Logo";

const LOG = [
  "[    0.000000] DeltaOS kernel 6.4.0-delta (gcc 14.2) #1 SMP PREEMPT",
  "[    0.004112] Command line: BOOT_IMAGE=/boot/vmdelta root=/dev/vda1 quiet splash",
  "[    0.019334] x86/fpu: Supporting XSAVE feature 0x001: 'x87 floating point registers'",
  "[    0.082211] Memory: 16384MB available (24576K kernel code)",
  "[    0.121907] smpboot: CPU0: Delta Virtual Processor @ 4.20GHz",
  "[    0.200417] ACPI: Interpreter enabled",
  "[    0.314455] deltafs: mounted virtual filesystem on /",
  "[    0.402988] glassd: compositor online (backdrop-blur: enabled)",
  "[    0.517203] wm: window manager ready",
  "[    0.601882] claude: assistant service registered",
  "[    0.702018] systemd[1]: Reached target Graphical Interface.",
];

const STEPS = ["Starting services", "Mounting virtual filesystem", "Launching compositor", "Preparing your desktop"];

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<"log" | "logo" | "out">("log");
  const [lines, setLines] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (stage !== "log") return;
    if (lines >= LOG.length) {
      const t = setTimeout(() => setStage("logo"), 220);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLines((l) => l + 1), 55 + Math.random() * 60);
    return () => clearTimeout(t);
  }, [stage, lines]);

  useEffect(() => {
    if (stage !== "logo") return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 2300);
      setProgress(1 - Math.pow(1 - p, 2.2));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setStage("out"), 250);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  useEffect(() => {
    if (stage !== "out") return;
    const t = setTimeout(onDone, 450);
    return () => clearTimeout(t);
  }, [stage, onDone]);

  useEffect(() => {
    const skip = () => setStage("out");
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, []);

  return (
    <div
      className="absolute inset-0 bg-[#030306] text-white overflow-hidden transition-opacity duration-500"
      style={{ opacity: stage === "out" ? 0 : 1 }}
      onClick={() => setStage("out")}
    >
      {stage === "log" && (
        <div className="absolute inset-0 p-8 font-mono text-[12px] leading-5 text-emerald-300/80">
          {LOG.slice(0, lines).map((l, i) => (
            <div key={i} className="anim-fade-in">
              {l.replace(/\].*/, "]")}
              <span className="text-zinc-300/80">{l.replace(/^\[[^\]]*\]/, "")}</span>
            </div>
          ))}
          <span className="inline-block w-2 h-4 bg-emerald-300/80 caret-blink align-middle" />
        </div>
      )}
      {stage !== "log" && (
        <div className="absolute inset-0 grid place-items-center anim-fade-in">
          <div
            className="absolute w-[900px] h-[900px] opacity-35"
            style={{ background: "radial-gradient(closest-side, var(--os-accent) 0%, color-mix(in oklab, var(--os-accent) 30%, transparent) 40%, transparent 100%)" }}
          />
          <div className="relative flex flex-col items-center">
            <DeltaLogo size={96} className="anim-glow" />
            <div className="mt-6 text-[34px] font-semibold tracking-tight">
              Delta<span className="font-light text-white/70">OS</span>
            </div>
            <div className="mt-10 w-64 h-[5px] rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress * 100}%`,
                  background: "linear-gradient(90deg, #a78bfa, var(--os-accent), #22d3ee)",
                  boxShadow: "0 0 12px var(--os-accent)",
                }}
              />
            </div>
            <div className="mt-4 h-5 text-[12px] text-white/45 tracking-wide">
              {STEPS[Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length))]}…
            </div>
          </div>
          <div className="absolute bottom-8 text-[11px] text-white/25">Press any key to skip</div>
        </div>
      )}
    </div>
  );
}
