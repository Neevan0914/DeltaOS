export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "D";
  return (
    <div
      className="rounded-full grid place-items-center font-semibold text-white shrink-0 relative overflow-hidden"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: "linear-gradient(135deg, #a78bfa 0%, var(--os-accent) 50%, #22d3ee 100%)",
        boxShadow: "0 10px 40px -10px var(--os-accent), inset 0 1px 0 rgb(255 255 255 / 0.4)",
        border: `${Math.max(1, size / 40)}px solid rgb(255 255 255 / 0.35)`,
      }}
    >
      {initials}
    </div>
  );
}
