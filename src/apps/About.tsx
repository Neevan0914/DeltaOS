import { Cpu, HardDrive, MemoryStick, Monitor, Sparkles } from "lucide-react";
import { useOS } from "../os/store";
import { formatSize, nodeSize } from "../os/vfs";
import { DeltaLogo } from "../components/Logo";
import { openApp } from "../os/windows";
import { Button } from "../components/ui";

export function AboutApp() {
  const fs = useOS((s) => s.fs);
  const used = nodeSize(fs);
  const v = window.deltaos?.versions;
  const rows = [
    { icon: Cpu, label: "Processor", value: `Delta Virtual CPU · ${navigator.hardwareConcurrency || 4} cores` },
    { icon: MemoryStick, label: "Memory", value: `${(navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 16} GB` },
    { icon: Monitor, label: "Display", value: `${window.screen.width} × ${window.screen.height}` },
    { icon: HardDrive, label: "Delta Disk", value: `${formatSize(used)} used of 64 GB` },
    { icon: Sparkles, label: "Runtime", value: v ? `Electron ${v.electron}` : "Web preview" },
  ];
  return (
    <div className="absolute inset-0 overflow-y-auto text-fg">
      <div className="relative h-44 overflow-hidden grid place-items-center" style={{ background: "radial-gradient(circle at 50% 120%, var(--os-accent), transparent 70%)" }}>
        <DeltaLogo size={84} className="anim-glow" />
      </div>
      <div className="text-center -mt-2">
        <div className="text-[24px] font-semibold tracking-tight">DeltaOS</div>
        <div className="text-[12.5px] text-muted">Version 1.2 “Aurora” · Build 2026.11</div>
      </div>
      <div className="m-6 rounded-2xl bg-surface border border-line divide-y divide-[var(--os-border)]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <r.icon size={16} className="text-accent" />
            <span className="text-[13px] font-medium w-28">{r.label}</span>
            <span className="text-[12.5px] text-muted flex-1 text-right truncate">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center pb-6">
        <Button onClick={() => openApp("settings", { section: "about" })}>More in Settings</Button>
      </div>
    </div>
  );
}
