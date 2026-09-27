import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopRoot, "..");

const packageJsonPath = path.join(desktopRoot, "package.json");
const tauriConfPath = path.join(desktopRoot, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(desktopRoot, "src-tauri", "Cargo.toml");
const cargoLockPath = path.join(desktopRoot, "src-tauri", "Cargo.lock");
const websiteConstantsPath = path.join(
  repoRoot,
  "website",
  "src",
  "lib",
  "constants.ts",
);

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(version).trim());
  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpPatch(version) {
  const parsed = parseSemver(version);
  parsed.patch += 1;
  return formatSemver(parsed);
}

function replaceExact(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Could not update ${label}: expected text not found`);
  }
  return content.replace(search, replacement);
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const nextVersion = bumpPatch(packageJson.version);
const prevVersion = packageJson.version;

packageJson.version = nextVersion;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = nextVersion;
writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`);

let cargoToml = readFileSync(cargoTomlPath, "utf8");
cargoToml = replaceExact(
  cargoToml,
  `version = "${prevVersion}"`,
  `version = "${nextVersion}"`,
  "Cargo.toml package version",
);
writeFileSync(cargoTomlPath, cargoToml);

let cargoLock = readFileSync(cargoLockPath, "utf8");
const desktopLockPattern = /(name = "desktop"\r?\n)version = "[^"]+"/;
if (!desktopLockPattern.test(cargoLock)) {
  throw new Error("Could not update Cargo.lock: desktop package entry not found");
}
cargoLock = cargoLock.replace(
  desktopLockPattern,
  `$1version = "${nextVersion}"`,
);
writeFileSync(cargoLockPath, cargoLock);

let websiteConstants = readFileSync(websiteConstantsPath, "utf8");
websiteConstants = replaceExact(
  websiteConstants,
  `CrackJobSetup-x64-${prevVersion}.msi`,
  `CrackJobSetup-x64-${nextVersion}.msi`,
  "website download filename",
);
writeFileSync(websiteConstantsPath, websiteConstants);

console.log(`MSI version bumped: ${prevVersion} → ${nextVersion}`);
