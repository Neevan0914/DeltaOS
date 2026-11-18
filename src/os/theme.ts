export interface Accent {
  id: string;
  name: string;
  hex: string;
}

export const ACCENTS: Accent[] = [
  { id: "violet", name: "Violet", hex: "#7c5cff" },
  { id: "blue", name: "Blue", hex: "#3b82f6" },
  { id: "cyan", name: "Cyan", hex: "#06b6d4" },
  { id: "emerald", name: "Emerald", hex: "#10b981" },
  { id: "amber", name: "Amber", hex: "#f59e0b" },
  { id: "orange", name: "Orange", hex: "#f97316" },
  { id: "rose", name: "Rose", hex: "#f43f5e" },
  { id: "pink", name: "Pink", hex: "#ec4899" },
];

export function resolveAccent(input: string): string | null {
  const v = input.trim().toLowerCase();
  const hit = ACCENTS.find((a) => a.id === v || a.name.toLowerCase() === v);
  if (hit) return hit.hex;
  const aliases: Record<string, string> = { purple: "violet", green: "emerald", red: "rose", yellow: "amber", teal: "cyan" };
  if (aliases[v]) return ACCENTS.find((a) => a.id === aliases[v])!.hex;
  if (/^#?[0-9a-f]{6}$/.test(v)) return v.startsWith("#") ? v : "#" + v;
  if (/^#?[0-9a-f]{3}$/.test(v)) {
    const h = v.replace("#", "");
    return "#" + h.split("").map((c) => c + c).join("");
  }
  return null;
}

export function accentName(hex: string) {
  return ACCENTS.find((a) => a.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Readable text color on top of the accent. */
export function accentForeground(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? "#0b0b10" : "#ffffff";
}
