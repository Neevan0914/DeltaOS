// Copies the portable build output to ./DeltaOS.exe in the project root.
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = "release";
const exe = readdirSync(dir).find((f) => f.toLowerCase().endsWith(".exe"));
if (!exe) {
  console.error("No .exe found in ./release");
  process.exit(1);
}
copyFileSync(join(dir, exe), "DeltaOS.exe");
const mb = (statSync("DeltaOS.exe").size / 1024 / 1024).toFixed(1);
console.log(`DeltaOS.exe ready in project root (${mb} MB)`);
