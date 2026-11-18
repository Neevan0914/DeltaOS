export interface Wallpaper {
  id: string;
  name: string;
  css: string;
}

const noise =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export const WALLPAPERS: Wallpaper[] = [
  {
    id: "aurora",
    name: "Aurora",
    css: `${noise}, radial-gradient(ellipse 80% 60% at 20% 20%, #3b2bff 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 85% 30%, #00d2ff 0%, transparent 55%), radial-gradient(ellipse 90% 70% at 60% 100%, #9b2cff 0%, transparent 60%), linear-gradient(160deg, #070b24 0%, #0d0630 100%)`,
  },
  {
    id: "nebula",
    name: "Nebula",
    css: `${noise}, radial-gradient(circle at 30% 70%, #ff3d81 0%, transparent 40%), radial-gradient(circle at 70% 30%, #6a3dff 0%, transparent 45%), radial-gradient(circle at 90% 90%, #ff9a3d 0%, transparent 35%), linear-gradient(135deg, #12001f 0%, #1a0533 50%, #08001a 100%)`,
  },
  {
    id: "sunset",
    name: "Sunset Dunes",
    css: `${noise}, radial-gradient(ellipse 120% 60% at 50% 110%, #ff5e3a 0%, transparent 60%), radial-gradient(ellipse 80% 50% at 80% 70%, #ff2a68 0%, transparent 60%), linear-gradient(180deg, #1b1035 0%, #5a1f5c 45%, #d9475b 75%, #ffb347 100%)`,
  },
  {
    id: "ocean",
    name: "Ocean Depths",
    css: `${noise}, radial-gradient(ellipse 60% 50% at 25% 25%, #00ffd5 0%, transparent 55%), radial-gradient(ellipse 80% 70% at 75% 75%, #0066ff 0%, transparent 60%), linear-gradient(200deg, #001a2c 0%, #002b4a 50%, #00111f 100%)`,
  },
  {
    id: "forest",
    name: "Forest Mist",
    css: `${noise}, radial-gradient(ellipse 70% 50% at 70% 20%, #b6ff8a55 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 20% 80%, #00a86b 0%, transparent 60%), linear-gradient(170deg, #04140c 0%, #0b2a1c 50%, #051a10 100%)`,
  },
  {
    id: "rose",
    name: "Rose Quartz",
    css: `${noise}, radial-gradient(circle at 20% 30%, #ffc2d1 0%, transparent 45%), radial-gradient(circle at 80% 70%, #b8c0ff 0%, transparent 50%), radial-gradient(circle at 60% 10%, #ffd6a5 0%, transparent 40%), linear-gradient(135deg, #f4d9e8 0%, #d9d3f7 100%)`,
  },
  {
    id: "mesh",
    name: "Midnight Mesh",
    css: `${noise}, repeating-linear-gradient(90deg, rgb(255 255 255 / 0.025) 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, rgb(255 255 255 / 0.025) 0 1px, transparent 1px 64px), radial-gradient(ellipse 70% 60% at 50% 40%, #2b3cff55 0%, transparent 70%), linear-gradient(180deg, #05060d 0%, #0b0f22 100%)`,
  },
  {
    id: "delta",
    name: "Delta Prism",
    css: `${noise}, conic-gradient(from 210deg at 50% 60%, #7c5cff, #00d2ff, #00ffa3, #ffd166, #ff4d8d, #7c5cff), linear-gradient(#000, #000)`,
  },
  {
    id: "graphite",
    name: "Graphite",
    css: `${noise}, radial-gradient(ellipse 90% 70% at 50% 0%, #3a3f4b 0%, transparent 70%), linear-gradient(180deg, #16181d 0%, #0b0c0f 100%)`,
  },
];

export const wallpaperById = (id: string) => WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
