import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptsDir, "..");

const cargoBin = path.join(homedir(), ".cargo", "bin");
const env = { ...process.env };
const pathKey = env.Path ? "Path" : "PATH";
const current = env[pathKey] ?? "";
if (!current.toLowerCase().includes(cargoBin.toLowerCase())) {
  env.Path = `${cargoBin}${path.delimiter}${current}`;
  env.PATH = env.Path;
}

const args = process.argv.slice(2);
const command = args[0];
const skipBump =
  process.env.CRACK_SKIP_VERSION_BUMP === "1" ||
  args.includes("--no-bump");

if (command === "build" && !skipBump) {
  const bumpScript = path.join(scriptsDir, "bump-msi-version.mjs");
  const bump = spawnSync(process.execPath, [bumpScript], {
    stdio: "inherit",
    env,
    cwd: desktopRoot,
    windowsHide: false,
  });
  if (bump.status !== 0) {
    process.exit(bump.status ?? 1);
  }
}

const cli = path.join(desktopRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
const tauriArgs = args.filter((arg) => arg !== "--no-bump");

const child = spawn(process.execPath, [cli, ...tauriArgs], {
  stdio: "inherit",
  env,
  cwd: desktopRoot,
  windowsHide: false,
});

let shuttingDown = false;

function shutdown(signal = "SIGTERM") {
  if (shuttingDown || child.killed) return;
  shuttingDown = true;
  child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code) => {
  if (code === 0 && command === "build") {
    const publish = spawnSync(
      process.execPath,
      [path.join(scriptsDir, "publish-msi.mjs")],
      {
        stdio: "inherit",
        env,
        cwd: desktopRoot,
        windowsHide: false,
      },
    );
    process.exit(publish.status ?? 1);
    return;
  }
  process.exit(code ?? 0);
});
