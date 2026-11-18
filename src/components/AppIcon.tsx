import { APPS } from "../apps/registry";
import type { AppId } from "../os/store";

export function AppIcon({ app, size = 40, radius }: { app: AppId; size?: number; radius?: number }) {
  const meta = APPS[app];
  const Icon = meta.icon;
  return (
    <div
      className="relative grid place-items-center shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size * 0.26,
        background: meta.gradient,
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -1px 0 rgb(0 0 0 / 0.2), 0 4px 14px -4px rgb(0 0 0 / 0.5)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" style={{ height: "50%" }} />
      <Icon size={size * 0.54} color="white" strokeWidth={1.9} className="relative drop-shadow" />
    </div>
  );
}
