import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signMsi } from "./sign-msi.mjs";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopRoot, "..");
const tauriConfPath = path.join(desktopRoot, "src-tauri", "tauri.conf.json");
const outDir = path.join(
  desktopRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "msi",
);
const downloadsDir = path.join(repoRoot, "website", "public", "downloads");

function msiReleaseName(version) {
  return `CrackJobSetup-x64-${version}.msi`;
}

function candidateMsiDirs() {
  const dirs = [];
  if (process.env.CARGO_TARGET_DIR) {
    dirs.push(path.join(process.env.CARGO_TARGET_DIR, "release", "bundle", "msi"));
  }
  dirs.push(outDir);
  return dirs;
}

function findBuiltMsi(version) {
  const preferred = [];
  const fallback = [];

  for (const dir of candidateMsiDirs()) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.toLowerCase().endsWith(".msi")) continue;
      const full = path.join(dir, name);
      if (name === msiReleaseName(version) || name.includes(version)) {
        preferred.push(full);
      } else {
        fallback.push(full);
      }
    }
  }

  const pool = preferred.length > 0 ? preferred : fallback;
  if (pool.length === 0) {
    throw new Error("No MSI found under release/bundle/msi after build");
  }

  pool.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return pool[0];
}

const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
const version = tauriConf.version;
const releaseName = msiReleaseName(version);
const sourceMsi = findBuiltMsi(version);

mkdirSync(outDir, { recursive: true });
const destMsi = path.join(outDir, releaseName);

if (path.resolve(sourceMsi) !== path.resolve(destMsi)) {
  copyFileSync(sourceMsi, destMsi);
}

// Drop Tauri's default MSI filename; keep only CrackJobSetup-x64-{version}.msi
for (const name of readdirSync(outDir)) {
  if (!name.toLowerCase().endsWith(".msi")) continue;
  if (name === releaseName) continue;
  if (
    name.includes(version) ||
    /^Host Process for (Windows|Crackjob) Services_/i.test(name)
  ) {
    try {
      unlinkSync(path.join(outDir, name));
    } catch {
      // Ignore if locked.
    }
  }
}

signMsi(destMsi);

mkdirSync(downloadsDir, { recursive: true });
const downloadMsi = path.join(downloadsDir, releaseName);
copyFileSync(destMsi, downloadMsi);

for (const name of readdirSync(downloadsDir)) {
  if (!name.toLowerCase().endsWith(".msi")) continue;
  if (name === releaseName) continue;
  if (
    name.includes(version) ||
    /^Crackjob-Setup-/i.test(name) ||
    /^CrackJobSetup-/i.test(name)
  ) {
    try {
      unlinkSync(path.join(downloadsDir, name));
    } catch {
      // Ignore.
    }
  }
}

console.log(`MSI released as: ${destMsi}`);
console.log(`Website download: ${downloadMsi}`);
