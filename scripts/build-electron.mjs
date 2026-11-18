// Bundles the Electron main + preload processes into self-contained CommonJS files,
// so the packaged app needs no node_modules at runtime.
import { build } from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  external: ["electron"],
  sourcemap: false,
  minify: true,
  logLevel: "info",
};

await build({ ...common, entryPoints: ["electron/main.ts"], outfile: "dist/main/main.js" });
await build({ ...common, entryPoints: ["electron/preload.ts"], outfile: "dist/main/preload.js" });
