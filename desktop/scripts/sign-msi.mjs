import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const TIMESTAMP_URL =
  process.env.CRACK_CODE_SIGN_TIMESTAMP_URL || "http://timestamp.digicert.com";

function kitRoots() {
  const roots = [];
  for (const key of ["ProgramFiles(x86)", "ProgramFiles", "PROGRAMFILES(X86)", "PROGRAMFILES"]) {
    const value = process.env[key];
    if (value) roots.push(path.join(value, "Windows Kits", "10", "bin"));
  }
  roots.push("C:\\Program Files (x86)\\Windows Kits\\10\\bin");
  roots.push("C:\\Program Files\\Windows Kits\\10\\bin");
  return [...new Set(roots)];
}

function findSignTool() {
  if (process.env.SIGNTOOL_PATH && existsSync(process.env.SIGNTOOL_PATH)) {
    return process.env.SIGNTOOL_PATH;
  }

  const matches = [];
  for (const root of kitRoots()) {
    if (!existsSync(root)) continue;
    for (const version of readdirSync(root)) {
      const candidate = path.join(root, version, "x64", "signtool.exe");
      if (existsSync(candidate)) {
        matches.push(candidate);
      }
    }
  }

  matches.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return matches[0] || null;
}

function runSignTool(signtool, args) {
  const result = spawnSync(signtool, args, {
    stdio: "inherit",
    windowsHide: false,
  });
  if (result.status !== 0) {
    throw new Error(`signtool failed with exit ${result.status ?? 1}`);
  }
}

export function signMsi(msiPath) {
  const thumbprint = (process.env.CRACK_CODE_SIGN_THUMBPRINT || "").trim();
  const pfxPath = (process.env.CRACK_CODE_SIGN_PFX || "").trim();
  const pfxPassword = process.env.CRACK_CODE_SIGN_PFX_PASSWORD || "";
  const required = process.env.CRACK_REQUIRE_CODE_SIGN === "1";

  if (!thumbprint && !pfxPath) {
    const message =
      "MSI not signed: set CRACK_CODE_SIGN_THUMBPRINT or CRACK_CODE_SIGN_PFX. SmartScreen will show Unknown publisher until a real code-signing certificate is used.";
    if (required) {
      throw new Error(message);
    }
    console.warn(message);
    return false;
  }

  const signtool = findSignTool();
  if (!signtool) {
    const message =
      "signtool.exe not found. Install Windows 10/11 SDK (Signing Tools) or set SIGNTOOL_PATH.";
    if (required) {
      throw new Error(message);
    }
    console.warn(message);
    return false;
  }

  const args = ["sign", "/fd", "SHA256", "/tr", TIMESTAMP_URL, "/td", "SHA256"];
  if (pfxPath) {
    if (!existsSync(pfxPath)) {
      throw new Error(`Code-signing PFX not found: ${pfxPath}`);
    }
    args.push("/f", pfxPath);
    if (pfxPassword) {
      args.push("/p", pfxPassword);
    }
  } else {
    args.push("/sha1", thumbprint);
  }
  args.push(msiPath);

  runSignTool(signtool, args);
  console.log(`Signed MSI: ${msiPath}`);
  return true;
}
